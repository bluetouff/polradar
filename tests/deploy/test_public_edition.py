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
    def test_tool_probe_follows_the_running_binary_version(self):
        probes = public['service_probes']
        legacy = probes('1.5.0')
        current = probes('1.6.0')
        self.assertNotIn('polradar_answer', legacy)
        self.assertEqual(set(current) - set(legacy), {'polradar_answer'})
        self.assertIn('CSG', current['polradar_answer']['question'])
        with self.assertRaises(ValueError):
            probes('version inconnue')

    def test_documentary_answer_parity_checks_the_two_revisions(self):
        endpoint = public['verify_answer_parity']
        corpus = {'revisionDuSite': REVISION, 'revisionDuService': 'b' * 40,
                  'versionContrat': 1}
        value = {'etat': 'documente'}
        reply = {**corpus, 'sansResultat': False, 'donnees': value}
        with patch.dict(endpoint.__globals__, {
            'fetch': lambda url, args: reply,
            'verify_call': lambda name, args, edition: value,
        }):
            endpoint(corpus, {'question': 'Que propose ce programme ?'})
            reply['revisionDuService'] = 'c' * 40
            with self.assertRaisesRegex(ValueError, 'REST et MCP'):
                endpoint(corpus, {'question': 'Que propose ce programme ?'})
            reply.update(corpus, donnees={'etat': 'partiel'})
            with self.assertRaisesRegex(ValueError, 'REST et MCP'):
                endpoint(corpus, {'question': 'Que propose ce programme ?'})

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
