import gzip
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

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
                with self.assertRaises(ValueError):
                    deployment.extract_static(archive([('large.txt', b'x' * 129)]), Path(temporary), SHA)
        finally:
            deployment.MAX_FILE = original_limit

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

    def test_untrusted_redirects_rejected(self):
        for url in ['http://github.com/file', 'https://github.com.evil.example/file', 'https://127.0.0.1/file', 'https://secret@github.com/file']:
            with self.assertRaises(ValueError):
                deployment.public_url(url)


if __name__ == '__main__':
    unittest.main()
