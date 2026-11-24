import io
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LAUNCHER = (ROOT / 'deploy/operations/activer.sh').read_text()
EXTRACT = LAUNCHER.split("<<'PYTHON_ARCHIVE'\n", 1)[1].split('\nPYTHON_ARCHIVE', 1)[0]
FILES = ('manifest.json','LICENSE','install.py','apache.conf','polradar-mcp','polradar-mcp.service','polradar-mcp.socket')

class OperatorArchive(unittest.TestCase):
    def unpack(self, names):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            with tarfile.open(root / 'paquet.tar.gz', 'w:gz') as archive:
                for name in names:
                    info = tarfile.TarInfo(name)
                    info.size = 1
                    archive.addfile(info, io.BytesIO(b'x'))
            run = subprocess.run([sys.executable,'-I','-',d,'mcp'],input=EXTRACT,text=True,capture_output=True)
            return run.returncode, {f.name for f in root.iterdir() if f.name != 'paquet.tar.gz'}

    def test_regular_members_only(self):
        self.assertEqual(self.unpack(FILES), (0,set(FILES)))
        for members in (FILES[:-1], (*FILES, 'extra.txt'), (*FILES, FILES[0])):
            status, extracted = self.unpack(members)
            self.assertNotEqual(status, 0)
            self.assertFalse(extracted)

    def test_provenance_before_privilege(self):
        self.assertLess(LAUNCHER.index('gh attestation verify "$package"'), LAUNCHER.index('sudo -v'))
        for flag in ('--source-ref refs/heads/main', '--deny-self-hosted-runners','--source-digest "$revision"','--signer-workflow bluetouff/polradar/.github/workflows/services.yml'):
            self.assertIn(flag, LAUNCHER)
