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


def archive(extra=(), sha=SHA):
    files = [('index.html', b'<!doctype html><title>Test</title>'), ('robots.txt', b'User-agent: *'), ('sitemap.xml', b'<urlset/>'), ('api/corpus.json', b'{}'), ('build.json', json.dumps({'sourceCommit': sha, 'repository': 'bluetouff/polradar'}).encode())]
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w') as bundle:
        for name, data in files + list(extra):
            member = tarfile.TarInfo(name)
            member.size = len(data)
            member.mode = 0o644
            bundle.addfile(member, io.BytesIO(data))
    return gzip.compress(raw.getvalue())


class DeploymentTests(unittest.TestCase):
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
            self.assertNotEqual(package('../' + name).returncode, 0)
            (dist / name).write_text('existing file')
            self.assertNotEqual(package(name).returncode, 0)

    def test_valid_static_release(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            deployment.extract_static(archive(), root, SHA)
            self.assertTrue((root / 'index.html').is_file())

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
        packed = archive([('fiche.html', b'fiche')])
        with tempfile.TemporaryDirectory() as tmp, patch.object(deployment, 'MAX_FILES', 6):
            deployment.extract_static(packed, Path(tmp), SHA)
            self.assertTrue((Path(tmp) / 'fiche.html').is_file())
        with tempfile.TemporaryDirectory() as tmp, patch.object(deployment, 'MAX_FILES', 5):
            with self.assertRaisesRegex(ValueError, 'too many files'):
                deployment.extract_static(packed, Path(tmp), SHA)
            self.assertFalse((Path(tmp) / 'fiche.html').exists())

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


if __name__ == '__main__':
    unittest.main()
