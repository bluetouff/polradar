import hashlib
import io
import json
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch


public = runpy.run_path(Path(__file__).parents[2] / 'scripts/etat-production.py')
verify = public['verify_surfaces']
REVISION = 'a' * 40


class PublicEditionTests(unittest.TestCase):
    def test_poll_counts_require_one_edition_and_group_scenarios_by_survey(self):
        polls = [
            {'surveyId': 'terrain-1', 'round': 'premier'},
            {'surveyId': 'terrain-1', 'round': 'second'},
            {'surveyId': 'terrain-2', 'round': 'premier'},
        ]
        health = {
            'sourceCommit': REVISION,
            'polls': {'observations': 3, 'documentedSurveys': 2, 'firstRound': 2, 'secondRound': 1},
        }
        quality = 'api/qualite-documentaire.json'
        survey_data = 'data/enquetes.json'

        def check():
            bodies = {
                quality: json.dumps(health).encode(),
                survey_data: json.dumps({'polls': polls}).encode(),
            }

            def open_response(request, timeout):
                response = io.BytesIO(bodies[request.full_url.removeprefix(public['SITE'] + '/')])
                response.headers = {}
                response.status = 200
                response.geturl = lambda: request.full_url
                return response

            marker = {
                'sourceCommit': REVISION,
                'sha256': {path: hashlib.sha256(body).hexdigest() for path, body in bodies.items()},
            }
            with patch.dict(verify.__globals__, {'SURFACES': tuple(bodies)}):
                with patch.object(public['opener'], 'open', open_response):
                    return verify(marker, {})

        self.assertEqual(set(check()), {quality, survey_data})
        health['polls']['documentedSurveys'] = 3
        with self.assertRaisesRegex(ValueError, 'compteurs de sondages diffèrent'):
            check()
        health['polls']['documentedSurveys'] = 2
        health['sourceCommit'] = 'b' * 40
        with self.assertRaisesRegex(ValueError, 'une autre édition'):
            check()
