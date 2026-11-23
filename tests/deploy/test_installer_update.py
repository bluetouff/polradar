import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

installer = Path(__file__).resolve().parents[2] / 'deploy' / 'install-user.py'


class InstallerUpdateTests(unittest.TestCase):
    def test_update_keeps_cron_and_replaces_the_executable_atomically(self):
        with tempfile.TemporaryDirectory() as scratch:
            home = Path(scratch)
            target = home / '.local/share/polradar/pull-release.py'
            target.parent.mkdir(parents=True)
            target.write_text('previous')
            with target.open() as opened, patch.object(Path, 'home', return_value=home), patch.object(os, 'geteuid', return_value=1000), patch.object(sys, 'argv', [str(installer), '--update-only']), patch.object(subprocess, 'run') as cron:
                with self.assertRaises(SystemExit) as stopped:
                    runpy.run_path(installer)
                self.assertEqual(stopped.exception.code, 0)
                self.assertEqual(opened.read(), 'previous')
                self.assertEqual(target.read_bytes(), installer.with_name('pull-release.py').read_bytes())
                self.assertEqual(target.stat().st_mode & 0o777, 0o600)
                cron.assert_not_called()

    def test_missing_or_interrupted_install_leaves_previous_file_intact(self):
        with tempfile.TemporaryDirectory() as scratch:
            home = Path(scratch)
            target = home / '.local/share/polradar/pull-release.py'
            with patch.object(Path, 'home', return_value=home), patch.object(os, 'geteuid', return_value=1000), patch.object(sys, 'argv', [str(installer), '--update-only']), patch.object(subprocess, 'run') as cron:
                with self.assertRaisesRegex(SystemExit, 'No installed deployer'):
                    runpy.run_path(installer)
                self.assertFalse(target.exists())
                target.write_text('previous')
                with patch('shutil.copyfileobj', side_effect=OSError('Interruption')):
                    with self.assertRaises(OSError):
                        runpy.run_path(installer)
                self.assertEqual(target.read_text(), 'previous')
                self.assertEqual(list(target.parent.iterdir()), [target])
                cron.assert_not_called()
