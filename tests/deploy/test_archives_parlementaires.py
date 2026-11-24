import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
DATA=json.loads((ROOT/'src/data/parlement/senat-europe.json').read_text())

class ArchivesParlementaires(unittest.TestCase):
    def test_perimetre_et_mandats(self):
        rows=DATA['scrutins']
        self.assertEqual(len({r['id'] for r in rows}),len(rows))
        self.assertEqual([sum(r['institution']==k for r in rows) for k in ('senat','parlement-europeen')],[673,299])
        self.assertEqual(sum(len(r['positions']) for r in rows),1101)
        for r in rows:
            self.assertGreaterEqual(min(r['pour'],r['contre'],r['abstentions']),0)
            for p in r['positions']:
                self.assertEqual(DATA['personnes'][p['personne']]['candidat'],p['candidat'])
                self.assertTrue(p['mandat'])
            self.assertNotRegex(r['objet'],r'[\x80-\x9f]|\\[nrt]')

    def test_retraite_au_senat(self):
        b=next(r for r in DATA['scrutins'] if r['id']=='senat-2022-233')
        self.assertEqual((b['date'],b['pour'],b['contre'],b['abstentions']),('2023-03-08',201,115,29))
        self.assertEqual((b['positions'][0]['personne'],b['positions'][0]['vote']),('04033B','pour'))
        self.assertIn('article 7',b['objet'])
        self.assertEqual(len(b['misesAuPoint']),4)
        self.assertNotIn('misesAuPoint',b['positions'][0])
        self.assertEqual(b['source'],'https://www.senat.fr/scrutin-public/2022/scr2022-233.html')

    def test_decisions_europeennes_et_absence(self):
        b=next(r for r in DATA['scrutins'] if r['id']=='MTG-PL-2024-03-13-DEC-166377')
        self.assertEqual((b['pour'],b['contre'],b['abstentions'],b['decision']),(262,351,8,'rejeté'))
        self.assertEqual((b['positions'][0]['personne'],b['positions'][0]['vote']),('197694','pour'))
        self.assertTrue(b['textes'][0].startswith('https://data.europarl.europa.eu/eli/dl/doc/'))
        self.assertTrue(all(r['date']!='2024-03-12' for r in DATA['scrutins'] if r['institution']=='parlement-europeen'))
        self.assertTrue(any(s['date']=='2024-03-12' and s['nominaux']>0 for s in DATA['sessionsEurope']))

if __name__=='__main__':
    unittest.main()
