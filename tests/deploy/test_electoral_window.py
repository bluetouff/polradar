import json
from datetime import datetime, timezone
from pathlib import Path
import runpy
import tempfile
import unittest

DEPLOY = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'deploy/pull-release.py'))
RULE = {'debut':'2030-01-01T00:00:00Z', 'fin':'2030-01-02T00:00:00Z',
        'source':'https://www.commission-des-sondages.fr/test-recette'}
NOW = datetime(2030, 1, 1, tzinfo=timezone.utc)


class ActivationWindowTest(unittest.TestCase):
    def test_old_new_and_operator_calendar_and_boundaries(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            old, new, state = [base / name for name in ('old','new','state')]
            for folder in (old/'api', new/'api', state): folder.mkdir(parents=True)
            for path in (old/'api/fenetres-sondages.json', new/'api/fenetres-sondages.json', state/'fenetres-sondages.json'):
                path.write_text(json.dumps({'version':1,'fenetres':[RULE]}))
                with self.assertRaises(DEPLOY['PublicationPaused']):
                    DEPLOY['check_activation_window'](old,new,state,NOW)
                DEPLOY['check_activation_window'](old,new,state,datetime(2030,1,2,tzinfo=timezone.utc))
                path.unlink()
            (new/'api/contrat-donnees.json').write_text('{}')
            with self.assertRaises(ValueError): DEPLOY['check_activation_window'](old,new,state,NOW)
            (new/'api/fenetres-sondages.json').write_text(json.dumps({'version':1,'fenetres':[dict(RULE,source='https://example.org/date')]}))
            with self.assertRaises(ValueError): DEPLOY['check_activation_window'](old,new,state,NOW)
