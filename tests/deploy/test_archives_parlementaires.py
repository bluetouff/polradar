import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
DATA=json.loads((ROOT/'src/data/parlement/senat-europe.json').read_text())

class ArchivesParlementaires(unittest.TestCase):
    def test_perimetre_et_mandats(self):
        rows=DATA['scrutins']
        self.assertEqual(len({r['id'] for r in rows}),len(rows))
        self.assertEqual([sum(r['institution']==k for r in rows) for k in ('senat','parlement-europeen')],[673,1576])
        self.assertEqual(sum(len(r['positions']) for r in rows),2378)
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

    def test_points_du_proces_verbal_et_totaux_recomptes(self):
        votes = [b for b in DATA['scrutins'] if b['institution'] == 'parlement-europeen']
        self.assertEqual(len(DATA['sessionsEurope']), 29)
        self.assertEqual(sum(d['nominaux'] for d in DATA['sessionsEurope']), 2147)
        for b in votes:
            self.assertTrue(b['procesVerbal'])
            for url in b['procesVerbal']:
                self.assertRegex(url, r'^https://data\.europarl\.europa\.eu/eli/dl/doc/PV-[0-9]+-' + b['date'] + r'-RCV-ITM-[0-9]+$')
        recomptes = {b['id']: (b['pour'], b['contre'], b['abstentions']) for b in votes if b.get('totauxComptes') == ['contre']}
        self.assertEqual(recomptes, {'MTG-PL-2026-07-09-DEC-195751': (594, 0, 2),
                                    'MTG-PL-2025-06-17-DEC-177027': (653, 0, 15)})
        b = next(r for r in votes if r['id'] == 'MTG-PL-2026-10-21-DEC-199339')
        self.assertEqual((b['pour'], b['contre'], b['abstentions']), (298, 307, 51))
        self.assertEqual((b['positions'][0]['vote'],b['positions'][0]['mandat']),
                         ('pour', 'membership/197694-f-169750'))
        self.assertTrue(b['procesVerbal'][0].endswith('/PV-10-2026-10-21-RCV-ITM-136'))
        self.assertFalse(any(r['date']=='2026-11-12' for r in votes))
        self.assertIn({'date':'2026-11-12','decisions':226,'nominaux':95}, DATA['sessionsEurope'])

if __name__=='__main__':
    unittest.main()
