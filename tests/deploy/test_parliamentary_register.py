import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('an_register', ROOT/'scripts/import-scrutins-assemblee.py')
reg = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reg)


class ParliamentaryRegisterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT/'src/data/parlement/assemblee.json').read_bytes())
        cls.ballots = {row['id']:row for row in cls.data['scrutins']}

    def test_official_an_id_mandate_and_individual_position(self):
        row = self.ballots['VTANR5L16V3213']
        positions = {p['candidat']:p for p in row['positions']}
        self.assertEqual(row['source'], 'https://www.assemblee-nationale.fr/dyn/16/scrutins/3213')
        self.assertEqual(row['date'],'2023-12-19')
        self.assertEqual(row['totaux'], {'votants':573,'exprimes':535,'majorite':268,'pour':349,'contre':186,'abstention':38})
        self.assertEqual(positions['dupont-aignan']['vote'],'abstention')
        self.assertEqual(positions['lepen']['vote'],'pour')
        self.assertEqual(self.data['mandats'][positions['lepen']['mandat']]['acteur'],'PA720614')
        self.assertEqual(self.data['groupes'][positions['lepen']['groupe']]['sigle'],'RN')

    def test_seventeenth_legislature_uses_the_reviewed_archive_and_mandates(self):
        source = self.data['sources'][-1]
        self.assertEqual((source['legislature'], source['scrutinsDansArchive'], source['scrutinsExamines']), (17,10101,10101))
        self.assertEqual(source['examinesDansEditionDetaillee'],5206)
        additional = self.data['complementXVII']
        self.assertEqual(len(additional),2135)
        self.assertFalse(set(self.ballots).intersection(b['id'] for b in additional))
        self.assertTrue(all(b['legislature']==17 and all(self.data['mandats'][p['mandat']]['acteur']==self.data['personnes'][p['candidat']]['id'] for p in b['positions']) for b in additional))
        rows = [b for b in self.ballots.values() if b['legislature'] == 17]
        self.assertEqual(len(rows),408)
        b = self.ballots['VTANR5L17V9759']
        self.assertEqual((b['date'], b['totaux']['pour'], b['totaux']['contre'], b['totaux']['abstention']), ('2026-11-04',0,458,2))
        self.assertEqual({p['candidat']:p['vote'] for p in b['positions']}, {'attal':'contre','lepen':'contre'})

    def test_mises_au_point_preserve_recorded_vote(self):
        row=self.ballots['VTANR5L16V8']
        fabien=next(p for p in row['positions'] if p['candidat']=='roussel')
        self.assertEqual(fabien['vote'],'pour')
        self.assertEqual(fabien['misesAuPoint'],[{'vote':'non-votant','nature':'mise-au-point'}])
        self.assertTrue(any(p['vote'] is None and p['misesAuPoint'] for b in self.ballots.values() for p in b['positions']))

    def test_motion_identifies_support_only_and_unknown_is_not_absence(self):
        row=self.ballots['VTANR5L16V1240']
        self.assertEqual((row['totaux']['pour'],row['totaux']['contre'],row['totaux']['abstention']),(278,None,None))
        self.assertNotIn('attal',[p['candidat'] for p in row['positions']])
        self.assertNotIn('VTCGR5L16V1', self.ballots)

    def test_every_published_position_has_a_verified_identity_and_mandate(self):
        d=self.data
        self.assertEqual(len(self.ballots),len(d['scrutins']))
        for row in d['scrutins']:
            self.assertEqual(row['id'], f"VTANR5L{row['legislature']}V{row['numero']}")
            self.assertEqual(len(row['positions']),len({p['candidat'] for p in row['positions']}))
            for p in row['positions']:
                self.assertEqual(d['mandats'][p['mandat']]['acteur'],d['personnes'][p['candidat']]['id'])
                if p['vote'] is not None:
                    self.assertIn(p['groupe'],d['groupes'])

    def test_import_rejects_unrecognized_choices_and_invalid_evidence(self):
        with self.assertRaisesRegex(ValueError,'Modalité'):
            list(reg.positions({'present':{'votant':{'acteurRef':'PA1'}}}))
        with self.assertRaises(ValueError):
            reg.integer('-2')
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'16-scrutins.zip'
            with zipfile.ZipFile(path,'w') as table:
                table.writestr('unexpected.json','{}')
            with self.assertRaisesRegex(ValueError,'Archive différente'):
                with reg.archive(Path(tmp),16,'scrutins',False):
                    self.fail('Archive acceptée')
            src=copy.deepcopy(reg.SOURCES)
            src[16]['scrutins']=('scrutins.zip',hashlib.sha256(path.read_bytes()).hexdigest())
            with patch.object(reg,'SOURCES',src), self.assertRaisesRegex(ValueError,'Membre ZIP inattendu'):
                with reg.archive(Path(tmp),16,'scrutins',False):
                    self.fail('Format étranger accepté')
