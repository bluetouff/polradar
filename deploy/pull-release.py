#!/usr/bin/env python3
"""Unprivileged, fail-closed pull deployment. Python standard library only."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
import tempfile
import urllib.parse
import urllib.request

MAX_ARCHIVE = 24 * 1024 * 1024
MAX_EXPANDED = 128 * 1024 * 1024
MAX_FILE = 10 * 1024 * 1024
MAX_FILES = 6000
EXTENSIONS = {'.html', '.css', '.js', '.json', '.xml', '.txt', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.ico', '.woff2'}
HOSTS = {'api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'}
SHA = re.compile(r'[0-9a-f]{40}')


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


@contextmanager
def bounded_tar(archive):
    """Check the complete gzip stream, including bytes after the TAR end markers."""
    if len(archive) > MAX_ARCHIVE:
        raise ValueError('Compressed archive too large')
    with tempfile.TemporaryFile() as expanded:
        with gzip.GzipFile(fileobj=io.BytesIO(archive)) as compressed:
            remaining = MAX_EXPANDED
            while True:
                chunk = compressed.read(min(64 * 1024, remaining + 1))
                if not chunk:
                    break
                if len(chunk) > remaining:
                    raise ValueError('Expanded archive too large')
                expanded.write(chunk)
                remaining -= len(chunk)
        expanded.seek(0)
        with tarfile.open(fileobj=expanded, mode='r:') as bundle:
            yield bundle


def extract_static(archive, destination, expected_sha):
    """Never use extractall: reject traversal, links, executables and oversized data."""
    if not SHA.fullmatch(expected_sha):
        raise ValueError('Invalid source commit')
    seen = set()
    total = 0
    with bounded_tar(archive) as bundle:
        for member in bundle:
            name = member.name
            parts = PurePosixPath(name).parts
            if not parts or name.startswith('/') or '\\' in name or any(not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]{0,180}', part) or part in ('.', '..') for part in name.split('/')):
                raise ValueError('Unsafe archive path')
            if name in seen or len(seen) >= MAX_FILES:
                raise ValueError('Duplicate path or too many files')
            seen.add(name)
            if not member.isfile() or member.mode & 0o111 or PurePosixPath(name).suffix.lower() not in EXTENSIONS:
                raise ValueError('Non-static archive member')
            total += member.size
            if member.size < 0 or member.size > MAX_FILE or total > MAX_EXPANDED:
                raise ValueError('Static file too large')
            target = destination.joinpath(*parts)
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
            with bundle.extractfile(member) as source, target.open('xb') as output:
                shutil.copyfileobj(source, output, length=64 * 1024)
            target.chmod(0o644)
    required = {'index.html', 'build.json', 'robots.txt', 'sitemap.xml', 'api/corpus.json'}
    if not required.issubset(seen):
        raise ValueError('Incomplete static release')
    manifest = json.loads((destination / 'build.json').read_text(encoding='utf-8'))
    if manifest.get('sourceCommit') != expected_sha or manifest.get('repository') != 'bluetouff/polradar':
        raise ValueError('Build provenance mismatch')
    for directory in destination.rglob('*'):
        if directory.is_dir():
            directory.chmod(0o755)


def check_live(sha):
    """Check the local Apache TLS vhost, without disabling certificate validation."""
    result = subprocess.run(['/usr/bin/curl', '--fail', '--silent', '--show-error', '--max-time', '20', '--resolve', 'polradar.fr:443:127.0.0.1', 'https://polradar.fr/build.json'], capture_output=True, check=True, timeout=25)
    if len(result.stdout) > 8192 or json.loads(result.stdout).get('sourceCommit') != sha:
        raise ValueError('Live commit mismatch')
    subprocess.run(['/usr/bin/curl', '--fail', '--silent', '--show-error', '--max-time', '20', '--resolve', 'polradar.fr:443:127.0.0.1', '--output', '/dev/null', 'https://polradar.fr/'], capture_output=True, check=True, timeout=25)


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
        if assets['site.tar.gz']['size'] > MAX_ARCHIVE or assets['site.sha256']['size'] > 1024:
            raise ValueError('Release asset too large')
        checksum = download(assets['site.sha256']['browser_download_url'], 1024).decode('ascii').strip()
        if not re.fullmatch(r'[0-9a-f]{64}  site\.tar\.gz', checksum):
            raise ValueError('Invalid checksum format')
        archive = download(assets['site.tar.gz']['browser_download_url'], MAX_ARCHIVE)
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
            check_activation_window(document_root, temporary, state)
            os.rename(temporary, target)
            try:
                activate(document_root, target, state, sha)
            except PublicationPaused:
                # The window began between the two checks, before the symlink switch.
                os.rename(target, temporary)
                raise
        except Exception:
            if temporary.exists():
                shutil.rmtree(temporary)
            # Preserve rejected completed releases for investigation; do not serve them.
            raise
        (state / 'last-success.json').write_text(json.dumps({'sourceCommit': sha}) + '\n')
        print(f'Deployed {sha}; local HTTPS checks passed.')


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
