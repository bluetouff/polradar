import json
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
needed=runpy.run_path(str(ROOT/'scripts/service-release-needed.py'))['needed']


class ServiceReleaseTest(unittest.TestCase):
    def test_superseded_service_then_content_only_push(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            def git(*args):
                return subprocess.check_output(['git','-c','user.name=Test','-c','user.email=test@example.invalid',
                                                '-c','commit.gpgsign=false',*args],cwd=root,text=True).strip()
            git('init','-q')
            (root/'mcp').mkdir()
            (root/'mcp/version').write_text('1')
            git('add','.');git('commit','-qm','base')
            def release():
                return {'tagName':'services-'+git('rev-parse','HEAD'),'isDraft':False,'isPrerelease':False}
            releases=[release()]
            self.assertFalse(needed(releases,root))
            (root/'mcp/version').write_text('2')
            git('add','.');git('commit','-qm','service')
            self.assertTrue(needed(releases,root))
            (root/'article').write_text('contenu suivant')
            git('add','.');git('commit','-qm','contenu')
            self.assertTrue(needed(releases,root))
            self.assertTrue(needed([dict(release(),isDraft=True),*releases],root))
            releases.append(release())
            (root/'article').write_text('troisième texte')
            git('add','.');git('commit','-qm','suite')
            self.assertFalse(needed(releases,root))

