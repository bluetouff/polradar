import gzip
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deployment', Path(__file__).parents[2] / 'deploy/pull-release.py')
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)
SHA = 'a' * 40


def archive(extra=(), sha=SHA, hashes=None, corpus=b'{}', prefix=()):
    marker = {'sourceCommit': sha, 'repository': 'bluetouff/polradar'}
    if hashes is not None:
        marker['sha256'] = hashes
    files = [('index.html', b'<!doctype html><title>Test</title>'), ('robots.txt', b'User-agent: *'), ('sitemap.xml', b'<urlset/>'), ('build.json', json.dumps(marker).encode())]
    if corpus is not None:
        files.append((deployment.CORPUS, corpus))
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w') as bundle:
        for name, data in [*prefix, *files, *extra]:
            member = tarfile.TarInfo(name)
            member.size = len(data)
            member.mode = 0o644
            bundle.addfile(member, io.BytesIO(data))
    return gzip.compress(raw.getvalue())


def partitioned_release(payload, modify=lambda manifest, fragments: None, *, leading=False, additional=()):
    sha256 = lambda data: hashlib.sha256(data).hexdigest()
    base = {'index.html': b'<!doctype html><title>Test</title>',
            'sitemap.xml': b'<urlset/>', deployment.CORPUS: payload}
    extra = [(path, b'{}') for path in sorted(deployment.PUBLIC_SURFACES - base.keys())]
    hashes = {path: sha256(body) for path, body in [*base.items(), *extra]}
    manifest = {'bytes': len(payload), 'version': 1, 'sourceCommit': SHA,
                'sha256': hashes[deployment.CORPUS], 'partitions': []}
    fragments = {}
    for offset in range(0, len(payload), 2048):
        fragment = payload[offset:offset + 2048]
        fragments[deployment.part_name(len(fragments))] = fragment
        manifest['partitions'].append({
            'collection': 'meta', 'offset': offset, 'bytes': len(fragment), 'sha256': sha256(fragment),
        })
    modify(manifest, fragments)
    marker = (deployment.CORPUS_PARTS_MANIFEST, json.dumps(manifest).encode())
    if not leading:
        extra.append(marker)
    return archive([*extra, *fragments.items(), *additional], hashes=hashes,
                   corpus=None, prefix=(marker,) if leading else ())


class DeploymentTests(unittest.TestCase):
    def test_mixed_release_is_rejected(self):
        protected = {
            'index.html': b'<!doctype html><title>Test</title>',
            'sitemap.xml': b'<urlset/>',
            'api/corpus.json': b'{}',
        }
        extra = [(path, b'{}') for path in sorted(deployment.PUBLIC_SURFACES - protected.keys())]
        hashes = {path: hashlib.sha256(body).hexdigest() for path, body in [*protected.items(), *extra]}
        with tempfile.TemporaryDirectory() as root:
            deployment.extract_static(archive(extra, hashes=hashes), Path(root), SHA)
        hashes['api/recherche.json'] = hashlib.sha256(b'[]').hexdigest()
        with tempfile.TemporaryDirectory() as root, self.assertRaisesRegex(ValueError, 'Public surface checksum mismatch'):
            deployment.extract_static(archive(extra, hashes=hashes), Path(root), SHA)

    def test_search_console_verification_packaging(self):
        packager = Path(__file__).resolve().parents[2] / 'scripts/package-release.py'
        name = 'google0123456789abcdef.html'
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            dist = root / 'dist'
            dist.mkdir()
            deployment.extract_static(archive(), dist, SHA)

            def package(value):
                env = {**os.environ, 'GITHUB_SHA': SHA, 'GSC_VERIFICATION_FILE': value}
                return subprocess.run([sys.executable, str(packager)], cwd=root, env=env, capture_output=True)

            for value in ['', name]:
                with self.subTest(value=value):
                    result = package(value)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    report = result.stdout.decode('utf-8')
                    self.assertIn('Plus grand fichier (octets)', report)
                    self.assertIn('TAR complet (octets)', report)
                    with tarfile.open(root / 'artifacts/site.tar.gz') as bundle:
                        self.assertEqual(name in bundle.getnames(), bool(value))
                        if value:
                            self.assertEqual(bundle.extractfile(name).read(), f'google-site-verification: {name}'.encode())
                            self.assertNotIn(name.encode(), bundle.extractfile('sitemap.xml').read())
            stable = (root / 'artifacts/site.tar.gz').read_bytes()
            result = package(name)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((root / 'artifacts/site.tar.gz').read_bytes(), stable)
            self.assertNotEqual(package('../' + name).returncode, 0)
            (dist / name).write_text('existing file')
            self.assertNotEqual(package(name).returncode, 0)

    def test_valid_static_release(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            deployment.extract_static(archive(), root, SHA)
            self.assertTrue((root / 'index.html').is_file())

    def test_partitioned_release_reconstructs_legacy_bytes(self):
        corpus = ('{"meta":{"edition":"Essai"}, "versions":[{"texte":"'
                  + 'é' * 2000 + '"}]}\n').encode()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            deployment.extract_static(partitioned_release(corpus), root, SHA)
            self.assertEqual((root / deployment.CORPUS).read_bytes(), corpus)
            self.assertTrue((root / deployment.CORPUS_PARTS_MANIFEST).is_file())
            self.assertFalse((root / deployment.CORPUS_PARTS_PREFIX).exists())

    def test_partitioned_packaging_reports_the_selected_limits(self):
        packager = Path(__file__).resolve().parents[2] / 'scripts/package-release.py'
        corpus = b'{"meta":{"edition":"Essai"}}'
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            dist = root / 'dist'
            dist.mkdir()
            deployment.extract_static(partitioned_release(corpus), dist, SHA)
            (dist / deployment.CORPUS_PARTS_MANIFEST).unlink()
            for mode in ('legacy', 'partitioned'):
                with self.subTest(mode=mode):
                    env = {**os.environ, 'GITHUB_SHA': SHA, 'GSC_VERIFICATION_FILE': ''}
                    result = subprocess.run([sys.executable, str(packager), '--format', mode],
                                            cwd=root, env=env, capture_output=True)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    report = json.loads((root / 'artifacts/site-capacity.json').read_bytes())
                    budget = deployment.archive_budget(mode == 'partitioned')
                    self.assertEqual(report['limits']['Archive gzip (octets)']['limit'], budget.compressed)
                    self.assertEqual(report['limits']['TAR complet (octets)']['limit'], budget.expanded)
                    self.assertEqual(report['limits']['Fichiers']['limit'], budget.members)
                    self.assertEqual(report['limits']['Plus grand fichier (octets)']['limit'], deployment.MAX_FILE)
                    with tarfile.open(root / 'artifacts/site.tar.gz') as bundle:
                        self.assertEqual(bundle.next().name == deployment.CORPUS_PARTS_MANIFEST,
                                         mode == 'partitioned')

    def test_only_leading_manifest_uses_expanded_transport_budget(self):
        corpus = b'{"meta":{"edition":"Essai"}}'
        ordinary = archive()
        previous = partitioned_release(corpus)
        current = partitioned_release(corpus, leading=True)
        tar_limit = len(gzip.decompress(current))
        old_limit = min(len(gzip.decompress(ordinary)), len(gzip.decompress(previous))) - 1
        with (
            patch.object(deployment, 'MAX_EXPANDED', old_limit),
            patch.object(deployment, 'PARTITIONED_MAX_EXPANDED', tar_limit),
        ):
            for packed in (ordinary, previous):
                with tempfile.TemporaryDirectory() as temporary:
                    with self.assertRaisesRegex(ValueError, 'Expanded archive too large'):
                        deployment.extract_static(packed, Path(temporary), SHA)
                    self.assertEqual(list(Path(temporary).iterdir()), [])
            with tempfile.TemporaryDirectory() as temporary:
                deployment.extract_static(current, Path(temporary), SHA)
                self.assertEqual((Path(temporary) / deployment.CORPUS).read_bytes(), corpus)
        with (
            tempfile.TemporaryDirectory() as temporary,
            patch.object(deployment, 'PARTITIONED_MAX_EXPANDED', tar_limit - 1),
        ):
            with self.assertRaisesRegex(ValueError, 'Expanded archive too large'):
                deployment.extract_static(current, Path(temporary), SHA)

    def test_partitioned_compressed_and_member_limits_are_independent(self):
        corpus = b'{"meta":{}}'
        old = partitioned_release(corpus)
        current = partitioned_release(corpus, leading=True)
        with tarfile.open(fileobj=io.BytesIO(current)) as bundle:
            count = len(bundle.getmembers())
        with (
            patch.object(deployment, 'MAX_ARCHIVE', len(old) - 1),
            patch.object(deployment, 'PARTITIONED_MAX_ARCHIVE', len(current)),
            patch.object(deployment, 'PARTITIONED_MAX_FILES', count),
        ):
            with tempfile.TemporaryDirectory() as temporary:
                with self.assertRaisesRegex(ValueError, 'Compressed archive too large'):
                    deployment.extract_static(old, Path(temporary), SHA)
                deployment.extract_static(current, Path(temporary), SHA)
        with (
            tempfile.TemporaryDirectory() as temporary,
            patch.object(deployment, 'PARTITIONED_MAX_FILES', count - 1),
        ):
            with self.assertRaisesRegex(ValueError, 'too many files'):
                deployment.extract_static(current, Path(temporary), SHA)
        packed = partitioned_release(corpus, leading=True, additional=[('grand.txt', b' ' * 4097)])
        with tempfile.TemporaryDirectory() as temporary, patch.object(deployment, 'MAX_FILE', 4096):
            with self.assertRaisesRegex(ValueError, 'Static file too large'):
                deployment.extract_static(packed, Path(temporary), SHA)

    def test_other_revision_is_rejected_before_spooling_partitioned_tar(self):
        packed = partitioned_release(b'{"meta":{}}', leading=True)
        with tempfile.TemporaryDirectory() as temporary, patch.object(deployment.tempfile, 'TemporaryFile') as spool:
            with self.assertRaisesRegex(ValueError, 'provenance mismatch'):
                deployment.extract_static(packed, Path(temporary), 'b' * 40)
            spool.assert_not_called()

    def test_available_disk_includes_allocation_blocks_for_the_new_edition(self):
        packed = partitioned_release(b'{"meta":{}}', leading=True)
        with (
            tempfile.TemporaryDirectory() as temporary,
            patch.object(deployment.shutil, 'disk_usage',
                         side_effect=[SimpleNamespace(free=2 * 1024 * 1024), SimpleNamespace(free=4096)]),
        ):
            with self.assertRaisesRegex(ValueError, 'Insufficient staging disk'):
                deployment.extract_static(packed, Path(temporary), SHA)
            self.assertEqual(list(Path(temporary).iterdir()), [])

    def test_inconsistent_partition_metadata_rejected(self):
        corpus = b'{"meta":{"edition":"Essai"}}'
        mutations = {
            'missing': (lambda _, parts: parts.pop(deployment.part_name(0)), 'inventory'),
            'unexpected': (lambda _, parts: parts.update({deployment.part_name(1): b'{}'}), 'inventory'),
            'revision': (lambda m, _: m.update(sourceCommit='b' * 40), 'provenance'),
            'summary': (lambda m, _: m.update(sha256='0' * 64), 'provenance'),
            'offset': (lambda m, _: m['partitions'][0].update(offset=1), 'Invalid corpus partition'),
            'size': (lambda m, _: m['partitions'][0].update(bytes=1), 'Invalid corpus partition'),
            'checksum': (lambda m, _: m['partitions'][0].update(sha256='0' * 64), 'partition checksum'),
        }
        for case, (mutate, error) in mutations.items():
            with self.subTest(case=case), tempfile.TemporaryDirectory() as temporary:
                with self.assertRaisesRegex(ValueError, error):
                    deployment.extract_static(partitioned_release(corpus, mutate), Path(temporary), SHA)

    def test_partitioned_release_needs_staging_disk_before_extraction(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(
            deployment.shutil, 'disk_usage', return_value=SimpleNamespace(free=0),
        ):
            root = Path(temporary)
            with self.assertRaisesRegex(ValueError, 'Insufficient staging disk'):
                deployment.extract_static(partitioned_release(b'{"meta":{}}'), root, SHA)
            self.assertEqual(list(root.iterdir()), [])

    def test_truncated_transport_stops_before_writing_files(self):
        packed = partitioned_release(b'{"meta":{"edition":"Essai"}}')
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with self.assertRaises(EOFError):
                deployment.extract_static(packed[:-8], root, SHA)
            self.assertEqual(list(root.iterdir()), [])

    def test_larger_corpus_checks_capability_and_rolls_back(self):
        old = 'b' * 40
        corpus = b'{"meta":{},"versions":["' + b'a' * 8192 + b'"]}'
        packed = partitioned_release(corpus)
        checksum = (hashlib.sha256(packed).hexdigest() + '  site.tar.gz\n').encode()
        release = {
            'tag_name': 'site-' + SHA,
            'assets': [
                {'name': 'site.tar.gz', 'size': len(packed), 'browser_download_url': 'archive'},
                {'name': 'site.sha256', 'size': len(checksum), 'browser_download_url': 'checksum'},
            ],
        }
        runs = {'workflow_runs': [{'head_sha': SHA, 'event': 'push', 'conclusion': 'success'}]}

        def reading(commit, supported):
            return json.dumps({
                'donnees': {'versionTransportCorpus': 1} if supported else {},
                'revisionDuSite': commit, 'revisionDuService': 'c' * 40, 'sansResultat': False,
            }).encode()

        cases = {
            'ancienne version': ([reading(old, False)], 'no partitioned corpus reader'),
            'service encore sur l’ancienne édition': ([reading(old, True), reading(old, True)], 'different edition'),
            'service sur la nouvelle édition': ([reading(old, True), reading(SHA, True)], None),
        }
        for case, (answers, error) in cases.items():
            with self.subTest(case=case), tempfile.TemporaryDirectory() as temporary:
                base = Path(temporary)
                previous = base / 'previous'
                previous.mkdir()
                (previous / 'build.json').write_text(json.dumps({'sourceCommit': old}))
                current = base / 'site'
                current.symlink_to(previous)
                args = SimpleNamespace(repository='bluetouff/polradar', document_root=current,
                                       state_root=base / 'state', releases_root=base / 'releases')
                with (
                    patch.object(deployment, 'MAX_FILE', 4096),
                    patch.object(deployment, 'api', side_effect=[release, {'sha': SHA}, runs, {'sha': SHA}]),
                    patch.object(deployment, 'download', side_effect=[checksum, packed]),
                    patch.object(deployment, 'check_live'),
                    patch.object(deployment, 'local_request', side_effect=answers) as checks,
                    patch.object(deployment, 'prune_releases', side_effect=OSError) as prune,
                ):
                    if error:
                        with self.assertRaisesRegex(ValueError, error):
                            deployment.synchronize(args)
                        self.assertEqual(current.resolve(), previous.resolve())
                        self.assertFalse((args.state_root / 'last-success.json').exists())
                        prune.assert_not_called()
                    else:
                        deployment.synchronize(args)
                        self.assertEqual(current.resolve(), (args.releases_root / SHA).resolve())
                        self.assertEqual((current / deployment.CORPUS).read_bytes(), corpus)
                        prune.assert_called_once_with(args.repository, current, args.releases_root, SHA, [])
                    self.assertEqual(checks.call_count, len(answers))
                    for call in checks.call_args_list:
                        self.assertEqual(call.args[0], 'api/v1/corpus')

    def test_paths_and_server_code_rejected(self):
        for name in ['../escape.html', '/absolute.html', 'a/../../escape.html', 'a\\escape.html', '.git/config', '.htaccess', 'shell.php', 'script.cgi', 'a//b.html']:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temporary:
                with self.assertRaises(ValueError):
                    deployment.extract_static(archive([(name, b'test')]), Path(temporary), SHA)

    def test_duplicate_and_wrong_commit_rejected(self):
        for data in [archive([('index.html', b'duplicate')]), archive(sha='b' * 40)]:
            with tempfile.TemporaryDirectory() as temporary:
                with self.assertRaises(ValueError):
                    deployment.extract_static(data, Path(temporary), SHA)

    def test_symlink_rejected(self):
        raw = io.BytesIO()
        with tarfile.open(fileobj=raw, mode='w') as bundle:
            member = tarfile.TarInfo('escape.html')
            member.type = tarfile.SYMTYPE
            member.linkname = '/etc/passwd'
            bundle.addfile(member)
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(ValueError):
                deployment.extract_static(gzip.compress(raw.getvalue()), Path(temporary), SHA)

    def test_oversized_file_rejected(self):
        original_limit = deployment.MAX_FILE
        deployment.MAX_FILE = 128
        try:
            with tempfile.TemporaryDirectory() as temporary:
                destination = Path(temporary)
                deployment.extract_static(archive([('large.txt', b'x' * 128)]), destination, SHA)
                self.assertEqual((destination / 'large.txt').stat().st_size, 128)
            with tempfile.TemporaryDirectory() as temporary:
                with self.assertRaises(ValueError):
                    deployment.extract_static(archive([('large.txt', b'x' * 129)]), Path(temporary), SHA)
        finally:
            deployment.MAX_FILE = original_limit

    def test_total_tar_limit_includes_end_padding_and_is_inclusive(self):
        packed = archive()
        actual = len(gzip.decompress(packed))
        for limit, accepted in ((actual, True), (actual - 1, False)):
            with self.subTest(limit=limit), tempfile.TemporaryDirectory() as temporary:
                with patch.object(deployment, 'MAX_EXPANDED', limit):
                    if accepted:
                        deployment.extract_static(packed, Path(temporary), SHA)
                    else:
                        with self.assertRaisesRegex(ValueError, 'Expanded archive too large'):
                            deployment.extract_static(packed, Path(temporary), SHA)
                        self.assertEqual(list(Path(temporary).iterdir()), [])

    def test_extra_gzip_data_after_tar_is_bounded(self):
        packed = archive()
        actual = len(gzip.decompress(packed))
        appended = packed + gzip.compress(b' ' * 2048)
        with tempfile.TemporaryDirectory() as temporary, patch.object(deployment, 'MAX_EXPANDED', actual):
            with self.assertRaisesRegex(ValueError, 'Expanded archive too large'):
                deployment.extract_static(appended, Path(temporary), SHA)

    def test_compressed_limit_checked_by_extractor(self):
        packed = archive()
        with tempfile.TemporaryDirectory() as temporary, patch.object(deployment, 'MAX_ARCHIVE', len(packed) - 1):
            with self.assertRaisesRegex(ValueError, 'Compressed archive too large'):
                deployment.extract_static(packed, Path(temporary), SHA)

    def test_file_count_includes_manifest_and_accepts_limit(self):
        required_files = 5
        additions = [
            (f'fiche-{number}.html', b'')
            for number in range(deployment.MAX_FILES - required_files)
        ]
        with tempfile.TemporaryDirectory() as tmp:
            deployment.extract_static(archive(additions), Path(tmp), SHA)
            self.assertTrue((Path(tmp) / additions[-1][0]).is_file())
        with tempfile.TemporaryDirectory() as tmp:
            packed = archive([*additions, ('trop.html', b'')])
            with self.assertRaisesRegex(ValueError, 'too many files'):
                deployment.extract_static(packed, Path(tmp), SHA)
            self.assertFalse((Path(tmp) / 'trop.html').exists())

    def test_initial_activation_and_rollback(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            current = base / 'site'
            current.mkdir()
            (current / 'old.txt').write_text('preserved')
            state = base / 'state'
            state.mkdir()
            release = base / 'release'
            release.mkdir()
            def fail(_):
                raise ValueError('HTTPS health check failed')
            with self.assertRaises(ValueError):
                deployment.activate(current, release, state, SHA, verify=fail)
            self.assertFalse(current.is_symlink())
            self.assertEqual((current / 'old.txt').read_text(), 'preserved')
            deployment.activate(current, release, state, SHA, verify=lambda _: None)
            self.assertEqual(current.resolve(), release.resolve())
            self.assertTrue((state / 'original-document-root/old.txt').exists())

    def test_existing_symlink_rollback(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            previous = base / 'previous'
            previous.mkdir()
            current = base / 'site'
            current.symlink_to(previous)
            release = base / 'release'
            release.mkdir()
            def fail(_):
                raise ValueError('Failed')
            with self.assertRaises(ValueError):
                deployment.activate(current, release, base, SHA, verify=fail)
            self.assertEqual(current.resolve(), previous.resolve())

    def test_release_is_discarded_if_main_changes_during_preparation(self):
        packed = archive()
        checksum = (hashlib.sha256(packed).hexdigest() + '  site.tar.gz\n').encode()
        release = {
            'tag_name': 'site-' + SHA,
            'assets': [
                {'name': 'site.tar.gz', 'size': len(packed), 'browser_download_url': 'archive'},
                {'name': 'site.sha256', 'size': len(checksum), 'browser_download_url': 'checksum'},
            ],
        }
        runs = {'workflow_runs': [{'head_sha': SHA, 'event': 'push', 'conclusion': 'success'}]}
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            current = root / 'site'
            current.mkdir()
            marker = current / 'build.json'
            marker.write_text(json.dumps({'sourceCommit': 'b' * 40}))
            args = SimpleNamespace(repository='bluetouff/polradar', document_root=current,
                                   state_root=root / 'state', releases_root=root / 'releases')
            with (
                patch.object(deployment, 'api', side_effect=[release, {'sha': SHA}, runs, {'sha': 'c' * 40}]),
                patch.object(deployment, 'download', side_effect=[checksum, packed]),
                patch.object(deployment, 'activate') as activate,
            ):
                deployment.synchronize(args)
            activate.assert_not_called()
            self.assertEqual(json.loads(marker.read_text())['sourceCommit'], 'b' * 40)
            self.assertEqual(list(args.releases_root.iterdir()), [])
            self.assertFalse((args.state_root / 'last-success.json').exists())

    def test_untrusted_redirects_rejected(self):
        for url in ['http://github.com/file', 'https://github.com.evil.example/file', 'https://127.0.0.1/file', 'https://secret@github.com/file']:
            with self.assertRaises(ValueError):
                deployment.public_url(url)


class RetentionTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.releases = Path(temporary.name).resolve()
        self.document_root = self.releases / 'live'
        self.repository = 'bluetouff/polradar'
        self.oldest, self.unverified, self.previous, self.recent = (letter * 40 for letter in 'bcde')
        for age, sha in enumerate((self.oldest, self.unverified, self.previous, self.recent, SHA), 1):
            self.add_release(sha, age)
        self.document_root.symlink_to(self.releases / SHA)

    def add_release(self, sha, timestamp):
        path = self.releases / sha
        path.mkdir()
        (path / 'build.json').write_text(json.dumps({'sourceCommit': sha}))
        os.utime(path, (timestamp, timestamp))

    def test_archive_requires_matching_tag_and_checksums(self):
        sha = self.oldest
        tag = f'site-{sha}'
        url = f'https://github.com/{self.repository}/releases/download/{tag}'
        archive_digest = 'f' * 64
        checksum = f'{archive_digest}  site.tar.gz\n'.encode('ascii')
        reference = {'ref': f'refs/tags/{tag}', 'object': {'type': 'commit', 'sha': sha}}
        release = {'tag_name': tag, 'target_commitish': sha, 'draft': False, 'prerelease': False, 'assets': [
            {'name': name, 'size': size, 'state': 'uploaded', 'digest': f'sha256:{digest}',
             'browser_download_url': f'{url}/{name}'}
            for name, size, digest in (
                ('site.tar.gz', 1234, archive_digest),
                ('site.sha256', len(checksum), hashlib.sha256(checksum).hexdigest()),
            )
        ]}
        with (
            patch.object(deployment, 'api', side_effect=[release, reference]) as api,
            patch.object(deployment, 'download', return_value=checksum) as download,
        ):
            self.assertTrue(deployment.verified_archive(self.repository, sha))
            download.assert_called_once_with(f'{url}/site.sha256', 1024)
            self.assertEqual(api.call_args.args, (self.repository, f'git/ref/tags/{tag}'))
        with (
            patch.object(deployment, 'api', side_effect=[release, {**reference, 'object': {'type': 'commit', 'sha': SHA}}]),
            patch.object(deployment, 'download', return_value=checksum),
        ):
            self.assertFalse(deployment.verified_archive(self.repository, sha))
        with (
            patch.object(deployment, 'api', return_value=release),
            patch.object(deployment, 'download', return_value=checksum.replace(b'f', b'0', 1)),
        ):
            self.assertFalse(deployment.verified_archive(self.repository, sha))
        release['assets'][0]['digest'] = f'sha256:{"0" * 64}'
        with (
            patch.object(deployment, 'api', return_value=release),
            patch.object(deployment, 'download', return_value=checksum),
        ):
            self.assertFalse(deployment.verified_archive(self.repository, sha))

    def test_retention_uses_legacy_and_persisted_successes(self):
        state = self.releases / 'state'
        state.mkdir()
        (state / 'last-success.json').write_text(json.dumps({'sourceCommit': self.recent}))
        log = state / 'deploy.log'
        log.write_text(
            f'Deployed {self.oldest}; local HTTPS checks passed.\n'
            f'Deployed {self.previous}; local HTTPS checks passed.\n'
            f'Deployed {"f" * 40}; local HTTPS checks passed.\n'
        )
        self.assertEqual(deployment.record_success(state, self.releases, SHA), [self.recent, self.previous])
        log.unlink()
        new_sha = '9' * 40
        self.add_release(new_sha, 8)
        self.assertEqual(deployment.record_success(state, self.releases, new_sha), [SHA, self.recent])

    def test_unchanged_cron_poll_does_not_prune(self):
        args = SimpleNamespace(repository=self.repository, document_root=self.document_root,
                               state_root=self.releases / 'state', releases_root=self.releases)
        with (
            patch.object(deployment, 'api', return_value={'tag_name': f'site-{SHA}'}),
            patch.object(deployment, 'prune_releases') as prune,
        ):
            deployment.synchronize(args)
        prune.assert_not_called()

    def test_retention_only_removes_unreferenced_older_verified_copies(self):
        linked, mounted, staged = '1' * 40, '2' * 40, '3' * 40
        self.add_release(linked, 1)
        self.add_release(mounted, 1)
        self.add_release(staged, 9)
        (self.releases / 'alias').symlink_to(self.releases / linked / 'build.json')
        (self.releases / ('4' * 40)).symlink_to(self.releases / SHA)
        with (
            patch.object(deployment, 'verified_archive',
                         side_effect=lambda _, sha: sha != self.unverified) as verify,
            patch.object(deployment, 'mount_locations', return_value=[self.releases / mounted / 'nested']),
        ):
            deployment.prune_releases(self.repository, self.document_root, self.releases, SHA, [self.recent])
            verify.assert_not_called()
            deployment.prune_releases(self.repository, self.document_root, self.releases, SHA, [self.recent, self.previous])
        self.assertFalse((self.releases / self.oldest).exists())
        for sha in (SHA, self.recent, self.previous, self.unverified, linked, mounted, staged, '4' * 40):
            self.assertTrue((self.releases / sha).exists(), sha)


if __name__ == '__main__':
    unittest.main()
