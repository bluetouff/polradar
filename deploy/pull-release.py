#!/usr/bin/env python3
"""Unprivileged, fail-closed pull deployment. Python standard library only."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
from http.client import HTTPException
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tarfile
import tempfile
from typing import NamedTuple
import urllib.parse
import urllib.request

MAX_ARCHIVE = 36 * 1024 * 1024
MAX_EXPANDED = 256 * 1024 * 1024
MAX_FILE = 10 * 1024 * 1024
MAX_FILES = 10000
PARTITIONED_MAX_ARCHIVE = 64 * 1024 * 1024
PARTITIONED_MAX_EXPANDED = 512 * 1024 * 1024
PARTITIONED_MAX_FILES = 20000
CORPUS = 'api/corpus.json'
CORPUS_PARTS_MANIFEST = 'api/corpus-parts.json'
CORPUS_PARTS_PREFIX = 'api/corpus-parts/'
MAX_CORPUS = 64 * 1024 * 1024
MAX_CORPUS_PART = 2 * 1024 * 1024
MAX_CORPUS_PARTS = 128
MAX_CORPUS_PARTS_MANIFEST = 32 * 1024
EXTENSIONS = {'.html', '.css', '.js', '.json', '.xml', '.txt', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.ico', '.woff2'}
HOSTS = {'api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'}
SHA = re.compile(r'[0-9a-f]{40}')
FINGERPRINT = re.compile(r'[0-9a-f]{64}')
DEPLOYED = re.compile(rb'^Deployed ([0-9a-f]{40}); local HTTPS checks passed\.$', re.MULTILINE)
COLLECTION = re.compile(r'[a-z][A-Za-z0-9]{0,59}')
PUBLIC_SURFACES = {
    'index.html', 'statistiques/index.html', 'recherche/index.html',
    'comparer/index.html', 'sondages/index.html', 'api/corpus.json',
    'api/recherche.json', 'api/exports-v1.json',
    'api/qualite-documentaire.json', 'data/enquetes.json',
    'data/choix-suivi.json', 'rss.xml', 'breves/rss.xml', 'sitemap.xml',
}


def surface_hashes(manifest):
    if 'sha256' not in manifest:
        return {}  # Previous releases remain available for rollback.
    values = manifest['sha256']
    if (not isinstance(values, dict) or set(values) != PUBLIC_SURFACES
            or any(not isinstance(v, str) or not FINGERPRINT.fullmatch(v)
                   for v in values.values())):
        raise ValueError('Invalid public surface manifest')
    return values


def public_url(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in HOSTS or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError('Untrusted download destination')
    return url


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        public_url(new_url)
        return super().redirect_request(request, fp, code, message, headers, new_url)


def download(url, limit):
    request = urllib.request.Request(public_url(url), headers={'User-Agent': 'Polradar-Public-Deployer/1', 'Accept': 'application/vnd.github+json' if urllib.parse.urlsplit(url).hostname == 'api.github.com' else 'application/octet-stream'})
    with urllib.request.build_opener(SafeRedirect()).open(request, timeout=30) as response:
        public_url(response.url)
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Download too large')
    return data


def api(repository, suffix):
    return json.loads(download(f'https://api.github.com/repos/{repository}/{suffix}', 2 * 1024 * 1024))


class ArchiveBudget(NamedTuple):
    compressed: int
    expanded: int
    members: int


def archive_budget(partitioned=False):
    if partitioned:
        return ArchiveBudget(PARTITIONED_MAX_ARCHIVE, PARTITIONED_MAX_EXPANDED, PARTITIONED_MAX_FILES)
    return ArchiveBudget(MAX_ARCHIVE, MAX_EXPANDED, MAX_FILES)


def archive_prefix(compressed, expected_sha):
    header = compressed.read(tarfile.BLOCKSIZE)
    try:
        first = tarfile.TarInfo.frombuf(header, 'utf-8', 'strict')
    except (tarfile.HeaderError, UnicodeError):
        # Let the full TAR reader handle older or invalid headers within legacy limits.
        return header, False
    if first.name != CORPUS_PARTS_MANIFEST:
        return header, False
    if first.type not in (tarfile.REGTYPE, tarfile.AREGTYPE) or first.mode & 0o111 or not 0 < first.size <= MAX_CORPUS_PARTS_MANIFEST:
        raise ValueError('Invalid leading corpus manifest')
    raw = compressed.read(first.size)
    if len(raw) != first.size:
        raise ValueError('Incomplete leading corpus manifest')
    manifest = parse_corpus_manifest(raw)
    if expected_sha is not None and manifest['sourceCommit'] != expected_sha:
        raise ValueError('Corpus transport provenance mismatch')
    return header + raw, True


@contextmanager
def bounded_tar(archive, *, expected_sha=None, staging=None):
    """Check the complete gzip stream, including bytes after the TAR end markers."""
    if len(archive) > PARTITIONED_MAX_ARCHIVE:
        raise ValueError('Compressed archive too large')
    with gzip.GzipFile(fileobj=io.BytesIO(archive)) as compressed:
        prefix, partitioned = archive_prefix(compressed, expected_sha)
        budget = archive_budget(partitioned)
        if len(archive) > budget.compressed:
            raise ValueError('Compressed archive too large')
        ceiling, error = budget.expanded, 'Expanded archive too large'
        if staging is not None:
            # Keep space for the installed edition while the temporary TAR is still open.
            space = shutil.disk_usage(staging).free // 2
            if space < ceiling:
                ceiling, error = space, 'Insufficient staging disk space'
        remaining = ceiling - len(prefix)
        if remaining < 0:
            raise ValueError(error)
        with tempfile.TemporaryFile(dir=staging) as expanded:
            expanded.write(prefix)
            while True:
                chunk = compressed.read(min(64 * 1024, remaining + 1))
                if not chunk:
                    break
                if len(chunk) > remaining:
                    raise ValueError(error)
                expanded.write(chunk)
                remaining -= len(chunk)
            expanded.seek(0)
            with tarfile.open(fileobj=expanded, mode='r:') as bundle:
                yield bundle, budget


def part_name(index):
    return f'{CORPUS_PARTS_PREFIX}{index:03d}.txt'


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate manifest key')
        result[key] = value
    return result


def parse_corpus_manifest(raw):
    manifest = json.loads(raw, object_pairs_hook=unique_object)
    if (not isinstance(manifest, dict)
            or set(manifest) != {'version', 'sourceCommit', 'sha256', 'bytes', 'partitions'}
            or type(manifest['version']) is not int or manifest['version'] != 1
            or not isinstance(manifest['sourceCommit'], str) or not SHA.fullmatch(manifest['sourceCommit'])
            or not isinstance(manifest['sha256'], str) or not FINGERPRINT.fullmatch(manifest['sha256'])
            or type(manifest['bytes']) is not int or not 0 < manifest['bytes'] <= MAX_CORPUS):
        raise ValueError('Corpus transport provenance mismatch')
    parts = manifest['partitions']
    if not isinstance(parts, list) or not 1 <= len(parts) <= MAX_CORPUS_PARTS:
        raise ValueError('Unexpected corpus partition inventory')
    offset = 0
    for part in parts:
        if (not isinstance(part, dict) or set(part) != {'collection', 'offset', 'bytes', 'sha256'}
                or not isinstance(part['collection'], str) or not COLLECTION.fullmatch(part['collection'])
                or type(part['offset']) is not int or part['offset'] != offset
                or type(part['bytes']) is not int or not 0 < part['bytes'] <= MAX_CORPUS_PART
                or not isinstance(part['sha256'], str) or not FINGERPRINT.fullmatch(part['sha256'])):
            raise ValueError('Invalid corpus partition')
        offset += part['bytes']
    if offset != manifest['bytes']:
        raise ValueError('Invalid corpus partition total')
    return manifest


def corpus_parts(bundle, members, expected_sha, digest):
    fragments = {name for name in members if name.startswith(CORPUS_PARTS_PREFIX)}
    if CORPUS_PARTS_MANIFEST not in members:
        if fragments or CORPUS not in members:
            raise ValueError('Incomplete corpus transport')
        return None
    marker = members[CORPUS_PARTS_MANIFEST]
    if CORPUS in members or not 0 < marker.size <= MAX_CORPUS_PARTS_MANIFEST:
        raise ValueError('Invalid corpus transport')
    with bundle.extractfile(marker) as raw:
        manifest = parse_corpus_manifest(raw.read())
    if manifest['sourceCommit'] != expected_sha or manifest['sha256'] != digest:
        raise ValueError('Corpus transport provenance mismatch')
    parts = manifest['partitions']
    if fragments != {part_name(i) for i in range(len(parts))}:
        raise ValueError('Unexpected corpus partition inventory')
    if any(members[part_name(i)].size != part['bytes'] for i, part in enumerate(parts)):
        raise ValueError('Invalid corpus partition size')
    return manifest


def assemble_corpus(bundle, members, target, manifest):
    digest = hashlib.sha256()
    with target.open('xb') as output:
        for i, part in enumerate(manifest['partitions']):
            with bundle.extractfile(members[part_name(i)]) as source:
                data = source.read()
            if len(data) != part['bytes'] or hashlib.sha256(data).hexdigest() != part['sha256']:
                raise ValueError('Corpus partition checksum mismatch')
            digest.update(data)
            output.write(data)
    if digest.hexdigest() != manifest['sha256']:
        raise ValueError('Corpus checksum mismatch')
    target.chmod(0o644)


def digest_stream(stream):
    checksum = hashlib.sha256()
    for chunk in iter(lambda: stream.read(64 * 1024), b''):
        checksum.update(chunk)
    return checksum.hexdigest()


def installed_space(members, parts, destination):
    fs = os.statvfs(destination)
    block = fs.f_frsize or fs.f_bsize
    dirs = set()
    sizes = []
    for name, member in members.items():
        if name.startswith(CORPUS_PARTS_PREFIX):
            continue
        sizes.append(member.size)
        dirs.update(PurePosixPath(name).parents)
    if parts is not None:
        sizes.append(parts['bytes'])
    dirs.discard(PurePosixPath('.'))
    blocks = sum((size + block - 1) // block for size in sizes) + len(dirs)
    return blocks * block


def extract_static(archive, destination, expected_sha):
    """Never use extractall: reject traversal, links, executables and oversized data."""
    if not SHA.fullmatch(expected_sha):
        raise ValueError('Invalid source commit')
    members = {}
    total = 0
    with bounded_tar(archive, expected_sha=expected_sha, staging=destination) as (bundle, budget):
        for member in bundle:
            name = member.name
            parts = PurePosixPath(name).parts
            if not parts or name.startswith('/') or '\\' in name or any(not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]{0,180}', part) or part in ('.', '..') for part in name.split('/')):
                raise ValueError('Unsafe archive path')
            if name in members or len(members) >= budget.members:
                raise ValueError('Duplicate path or too many files')
            if member.type not in (tarfile.REGTYPE, tarfile.AREGTYPE) or member.mode & 0o111 or PurePosixPath(name).suffix.lower() not in EXTENSIONS:
                raise ValueError('Non-static archive member')
            total += member.size
            if member.size < 0 or member.size > MAX_FILE or total > budget.expanded:
                raise ValueError('Static file too large')
            members[name] = member
        required = {'index.html', 'build.json', 'robots.txt', 'sitemap.xml'}
        if not required.issubset(members):
            raise ValueError('Incomplete static release')
        if members['build.json'].size > 8192:
            raise ValueError('Build manifest too large')
        with bundle.extractfile(members['build.json']) as raw:
            manifest = json.load(raw, object_pairs_hook=unique_object)
        if not isinstance(manifest, dict) or manifest.get('sourceCommit') != expected_sha or manifest.get('repository') != 'bluetouff/polradar':
            raise ValueError('Build provenance mismatch')
        hashes = surface_hashes(manifest)
        parts = corpus_parts(bundle, members, expected_sha, hashes.get(CORPUS))
        if shutil.disk_usage(destination).free < installed_space(members, parts, destination):
            raise ValueError('Insufficient staging disk space')
        for name, member in members.items():
            if name.startswith(CORPUS_PARTS_PREFIX):
                continue
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
            with bundle.extractfile(member) as source, target.open('xb') as output:
                shutil.copyfileobj(source, output, length=64 * 1024)
            target.chmod(0o644)
        if parts is not None:
            assemble_corpus(bundle, members, destination / CORPUS, parts)
    for name, digest in hashes.items():
        if name == CORPUS and parts is not None:
            continue  # The reconstructed bytes already match this exact digest.
        if name not in members:
            raise ValueError(f'Public surface missing: {name}')
        with (destination / name).open('rb') as stream:
            if digest_stream(stream) != digest:
                raise ValueError(f'Public surface checksum mismatch: {name}')
    for directory in destination.rglob('*'):
        if directory.is_dir():
            directory.chmod(0o755)


def check_live(sha):
    """Check the local Apache TLS vhost, without disabling certificate validation."""
    marker = json.loads(local_request('build.json', 8192))
    if marker.get('sourceCommit') != sha:
        raise ValueError('Live commit mismatch')
    hashes = surface_hashes(marker)
    if not hashes:
        local_request('', MAX_FILE)
    for name in ('index.html', 'api/recherche.json', CORPUS, 'rss.xml') if hashes else ():
        path = name.removesuffix('index.html')
        limit = MAX_CORPUS if name == CORPUS else MAX_FILE
        with tempfile.TemporaryFile() as response:
            local_request(path, limit, response)
            response.seek(0)
            if digest_stream(response) != hashes[name]:
                raise ValueError(f'Live public surface mismatch: {name}')


def local_request(path, limit, output=subprocess.PIPE):
    return subprocess.run([
        '/usr/bin/curl', '--fail', '--silent', '--show-error',
        '--proto', '=https', '--max-time', '10', '--max-filesize', str(limit),
        '--resolve', 'polradar.fr:443:127.0.0.1', 'https://polradar.fr/' + path,
    ], stdout=output, stderr=subprocess.PIPE, check=True, timeout=12).stdout


def partition_reader_revision():
    response = json.loads(local_request('api/v1/corpus', 32768))
    data = response.get('donnees')
    revision = response.get('revisionDuSite')
    service = response.get('revisionDuService')
    if (not isinstance(data, dict) or type(data.get('versionTransportCorpus')) is not int
            or data['versionTransportCorpus'] != 1 or response.get('sansResultat') is not False
            or not isinstance(service, str) or not SHA.fullmatch(service)
            or not isinstance(revision, str) or not SHA.fullmatch(revision)):
        raise ValueError('Active service has no partitioned corpus reader')
    return revision


def check_live_partitioned(sha):
    check_live(sha)
    if partition_reader_revision() != sha:
        raise ValueError('Live service reads a different edition')


class PublicationPaused(ValueError):
    """A verified electoral window holds the currently served edition."""


def check_activation_window(document_root, release, state_root, now=None):
    now = now or datetime.now(timezone.utc)
    allowed = {'www.legifrance.gouv.fr', 'www.conseil-constitutionnel.fr',
               'www.commission-des-sondages.fr', 'www.interieur.gouv.fr'}
    paths = [state_root / 'fenetres-sondages.json']
    for root in (document_root, release):
        calendar = root / 'api/fenetres-sondages.json'
        if (root / 'api/contrat-donnees.json').exists() and not calendar.is_file():
            raise ValueError('Calendrier manquant dans une édition versionnée')
        paths.append(calendar)
    for path in paths:
        if not path.exists():
            continue
        with path.open('rb') as stream:
            raw = stream.read(65537)
        if len(raw) > 65536:
            raise ValueError('Calendrier trop volumineux')
        rules = json.loads(raw)
        if type(rules.get('version')) is not int or rules['version'] != 1 or not isinstance(rules.get('fenetres'), list):
            raise ValueError('Calendrier de publication invalide')
        for window in rules['fenetres']:
            source = urllib.parse.urlsplit(window['source'])
            if (source.scheme != 'https' or source.netloc not in allowed or not source.path.strip('/')):
                raise ValueError('Source du calendrier invalide')
            instants = []
            for key in ('debut', 'fin'):
                value = window[key]
                if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', value):
                    raise ValueError('Date de publication invalide')
                instants.append(datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc))
            start, end = instants
            if end <= start:
                raise ValueError('Fenêtre vide')
            if start <= now < end:
                raise PublicationPaused('Édition électorale gelée')


def activate(document_root, release, state_root, sha, verify=check_live):
    check_activation_window(document_root, release, state_root)
    previous_link = os.readlink(document_root) if document_root.is_symlink() else None
    backup = state_root / 'original-document-root'
    if previous_link is None and (not document_root.is_dir() or backup.exists()):
        raise ValueError('Document root needs operator review')
    temporary_link = document_root.parent / f'.polradar-switch-{os.getpid()}'
    if os.path.lexists(temporary_link):
        raise ValueError('Stale activation path')
    try:
        temporary_link.symlink_to(release, target_is_directory=True)
        if previous_link is None:
            os.rename(document_root, backup)
        os.replace(temporary_link, document_root)
        verify(sha)
    except Exception:
        if previous_link is not None:
            rollback = document_root.parent / f'.polradar-rollback-{os.getpid()}'
            rollback.symlink_to(previous_link, target_is_directory=True)
            os.replace(rollback, document_root)
        elif backup.is_dir():
            if document_root.is_symlink():
                document_root.unlink()
            os.rename(backup, document_root)
        raise
    finally:
        if temporary_link.is_symlink():
            temporary_link.unlink()


def local_release(releases, sha):
    path = releases / sha
    try:
        info = path.lstat()
        if (not stat.S_ISDIR(info.st_mode) or info.st_dev != releases.stat().st_dev
                or info.st_uid != os.geteuid()):
            return None
        with os.fdopen(os.open(path / 'build.json', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb') as stream:
            marker = os.fstat(stream.fileno())
            if not stat.S_ISREG(marker.st_mode) or marker.st_size > 65536:
                return None
            data = json.loads(stream.read(65537))
        if isinstance(data, dict) and data.get('sourceCommit') == sha:
            return info
    except (OSError, ValueError):
        return None
    return None


def record_success(state, releases, sha):
    checkpoint = state / 'last-success.json'
    previous = []
    try:
        saved = json.loads(checkpoint.read_text())
        if isinstance(saved, dict):
            previous.append(saved.get('sourceCommit'))
            if isinstance(saved.get('rollback'), list):
                previous.extend(saved['rollback'])
    except (FileNotFoundError, ValueError):
        pass
    # Bootstrap from the previous deployer's success records.
    try:
        with (state / 'deploy.log').open('rb') as log:
            log.seek(max(0, os.fstat(log.fileno()).st_size - 256 * 1024))
            previous.extend(item.decode('ascii') for item in reversed(DEPLOYED.findall(log.read(256 * 1024))))
    except FileNotFoundError:
        pass
    rollback = []
    for old in previous:
        if (isinstance(old, str) and SHA.fullmatch(old) and old != sha
                and old not in rollback and local_release(releases, old) is not None):
            rollback.append(old)
            if len(rollback) == 2:
                break
    fd, temporary = tempfile.mkstemp(prefix='.last-success-', dir=state)
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(json.dumps({'sourceCommit': sha, 'rollback': rollback}) + '\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, checkpoint)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return rollback


def verified_archive(repository, sha):
    tag = f'site-{sha}'
    release = api(repository, f'releases/tags/{tag}')
    if (release.get('tag_name') != tag or release.get('target_commitish') != sha
            or release.get('draft') is not False or release.get('prerelease') is not False):
        return False
    digests = {}
    url = f'https://github.com/{repository}/releases/download/{tag}'
    for name, ceiling in (('site.tar.gz', PARTITIONED_MAX_ARCHIVE), ('site.sha256', 1024)):
        matches = [asset for asset in release['assets'] if asset.get('name') == name]
        if len(matches) != 1:
            return False
        asset = matches[0]
        digest = asset.get('digest')
        size = asset.get('size')
        if (asset.get('state') != 'uploaded' or type(size) is not int or not 0 < size <= ceiling
                or asset.get('browser_download_url') != f'{url}/{name}'
                or not isinstance(digest, str) or not re.fullmatch(r'sha256:[0-9a-f]{64}', digest)):
            return False
        digests[name] = digest.removeprefix('sha256:')
    checksum = download(f'{url}/site.sha256', 1024)
    if (hashlib.sha256(checksum).hexdigest() != digests['site.sha256']
            or checksum.strip() != f"{digests['site.tar.gz']}  site.tar.gz".encode('ascii')):
        return False
    reference = api(repository, f'git/ref/tags/{tag}')
    target = reference['object']
    return (reference['ref'] == f'refs/tags/{tag}'
            and target['type'] == 'commit' and target['sha'] == sha)


def mount_locations():
    # Linux exposes bind mounts as well as mounts on different devices here.
    for line in Path('/proc/self/mountinfo').read_text().splitlines():
        mountpoint = line.split(' ', 5)[4]
        yield Path(re.sub(r'\\([0-7]{3})', lambda match: chr(int(match[1], 8)), mountpoint))


def prune_releases(repository, document_root, releases, sha, rollback):
    if len(rollback) != 2:
        print('Retention: skipped; fewer than two local rollback releases.', flush=True)
        return
    if not shutil.rmtree.avoids_symlink_attacks or releases.resolve(strict=True) != releases:
        return
    active = releases / sha
    if not document_root.is_symlink() or document_root.resolve(strict=True) != active:
        return
    keep = {sha, *rollback}
    protected = [local_release(releases, item) for item in keep]
    if any(info is None for info in protected):
        return
    cutoff = min(info.st_mtime_ns for info in protected)
    for path in sorted(releases.iterdir()):
        if path.name in keep or not SHA.fullmatch(path.name):
            continue
        info = local_release(releases, path.name)
        if info is None or info.st_mtime_ns >= cutoff:
            continue
        try:
            archived = verified_archive(repository, path.name)
        except (OSError, HTTPException, ValueError, AttributeError, KeyError, TypeError):
            archived = False
        if not archived:
            print(f'Retention: kept {path.name}; GitHub archive could not be verified.', flush=True)
            continue
        # Recheck live references after the network calls, immediately before removing a directory.
        if not document_root.is_symlink() or document_root.resolve(strict=True) != active:
            return
        aliases = (link.resolve() for folder in (document_root.parent, releases)
                   for link in folder.iterdir() if link.is_symlink())
        if any(location == path or path in location.parents for location in (*mount_locations(), *aliases)):
            continue
        latest = local_release(releases, path.name)
        if latest is not None and os.path.samestat(info, latest) and info.st_ctime_ns == latest.st_ctime_ns:
            shutil.rmtree(path)
            print(f'Retention: removed {path.name}; GitHub archive verified.', flush=True)
    print(f'Retention: completed for {sha}.', flush=True)


def synchronize(args):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', args.repository):
        raise ValueError('Invalid repository')
    state = Path(args.state_root).resolve()
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    state.chmod(0o700)
    with (state / 'deployment.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        release = api(args.repository, 'releases/latest')
        tag = release.get('tag_name', '')
        if not re.fullmatch(r'site-[0-9a-f]{40}', tag):
            raise ValueError('Invalid release tag')
        sha = tag.removeprefix('site-')
        if release.get('draft') or release.get('prerelease') or not SHA.fullmatch(sha):
            raise ValueError('Invalid release tag')
        document_root = Path(args.document_root).absolute()
        current = document_root / 'build.json'
        if current.is_file() and json.loads(current.read_text()).get('sourceCommit') == sha:
            return
        main = api(args.repository, 'commits/main')['sha']
        if main != sha:
            print('Waiting for a validated release of current main.')
            return
        runs = api(args.repository, 'actions/workflows/site.yml/runs?branch=main&status=success&per_page=10')['workflow_runs']
        if not any(run['head_sha'] == sha and run['event'] == 'push' and run['conclusion'] == 'success' for run in runs):
            raise ValueError('Successful main workflow missing')
        assets = {item['name']: item for item in release['assets']}
        if not {'site.tar.gz', 'site.sha256'}.issubset(assets):
            raise ValueError('Release assets missing')
        if assets['site.tar.gz']['size'] > PARTITIONED_MAX_ARCHIVE or assets['site.sha256']['size'] > 1024:
            raise ValueError('Release asset too large')
        checksum = download(assets['site.sha256']['browser_download_url'], 1024).decode('ascii').strip()
        if not re.fullmatch(r'[0-9a-f]{64}  site\.tar\.gz', checksum):
            raise ValueError('Invalid checksum format')
        archive = download(assets['site.tar.gz']['browser_download_url'], PARTITIONED_MAX_ARCHIVE)
        if hashlib.sha256(archive).hexdigest() != checksum[:64]:
            raise ValueError('Release checksum mismatch')
        releases = Path(args.releases_root).absolute()
        releases.mkdir(parents=True, exist_ok=True, mode=0o755)
        releases.chmod(0o755)
        target = releases / sha
        # A completed release is never overwritten. Failed extraction stays private.
        if target.exists():
            raise ValueError('Release directory already exists; operator review required')
        temporary = Path(tempfile.mkdtemp(prefix='.incoming-', dir=releases))
        try:
            extract_static(archive, temporary, sha)
            temporary.chmod(0o755)
            needs_reader = (temporary / CORPUS).stat().st_size > MAX_FILE
            check_activation_window(document_root, temporary, state)
            if api(args.repository, 'commits/main')['sha'] != sha:
                print('Main changed during preparation. Waiting for the current release.')
                return
            if needs_reader:
                if not current.is_file() or partition_reader_revision() != json.loads(current.read_text()).get('sourceCommit'):
                    raise ValueError('Active service reads a different edition')
            os.rename(temporary, target)
            try:
                activate(document_root, target, state, sha, verify=check_live_partitioned if needs_reader else check_live)
            except PublicationPaused:
                # The window began between the two checks, before the symlink switch.
                os.rename(target, temporary)
                raise
        finally:
            if temporary.exists():
                shutil.rmtree(temporary)
            # Preserve rejected completed releases for investigation; do not serve them.
        print(f'Deployed {sha}; local HTTPS checks passed.', flush=True)
        try:
            rollback = record_success(state, releases, sha)
            prune_releases(args.repository, document_root, releases, sha, rollback)
        except Exception as error:
            # A retention error cannot undo a publication already verified over HTTPS.
            print(f'Retention interrupted ({type(error).__name__}).', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repository', default='bluetouff/polradar')
    parser.add_argument('--document-root', default='/var/www/html/polradar')
    parser.add_argument('--state-root', default=str(Path.home() / '.local/share/polradar'))
    parser.add_argument('--releases-root', default='/var/www/html/.polradar-releases')
    args = parser.parse_args()
    try:
        synchronize(args)
    except Exception as error:
        # GitHub redirects can contain signed URLs: never print exception messages.
        print(f'Deployment rejected ({type(error).__name__}). Previous version retained.')
        raise SystemExit(1) from None


if __name__ == '__main__':
    main()
