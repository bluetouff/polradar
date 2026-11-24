import json
import runpy
import unittest
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
IMPORT = runpy.run_path(str(ROOT/'scripts/import-textes-senat.py'))
DATA = json.loads((ROOT/'src/data/parlement/textes-senat.json').read_bytes())
DOCS = {row['id']: row for row in DATA['documents']}

class SenateDocuments(unittest.TestCase):
    def test_documents_signatures_et_mandats(self):
        self.assertEqual(len(DOCS),len(DATA['documents']))
        self.assertEqual(len({v['source'] for v in DOCS.values()}),len(DOCS))
        count = Counter(row['categorie'] for row in DOCS.values())
        self.assertEqual(count,{'proposition-de-loi':261,'autre-texte':54,'rapport':19})
        for item in DOCS.values():
            self.assertEqual(urlsplit(item['source']).hostname,'www.senat.fr')
            self.assertTrue(item['titre'] and item['numero'])
            for signature in item['signatures']:
                self.assertTrue(signature['mandat'] and signature['codesSignatures'])
                self.assertEqual(DATA['personnes'][signature['personne']]['candidat'], signature['candidat'])
        self.assertEqual(len(DATA['signaturesSansDocument']),2)
    def test_references_historiques_dedoublonnees(self):
        avis=DOCS['senat-rapport-a08-152']
        self.assertEqual(avis['codesDOSLEG'],['65808','66102'])
        self.assertEqual(avis['signatures'][0]['codesSignatures'],['133777','138254'])
        self.assertEqual(avis['source'],'https://www.senat.fr/rap/a08-152/a08-152.html')
        municipales=DOCS['senat-texte-762']
        self.assertEqual(municipales['source'],'https://www.senat.fr/leg/ppl99-128.html')
        self.assertEqual((municipales['dateDepot'],municipales['signatures'][0]['role'],municipales['signatures'][0]['personne']),('1999-12-11','coauteur','86039K'))
        self.assertEqual(DOCS['senat-rapport-r10-302']['titre'],"La neutralité de l'Internet")
        self.assertEqual(DOCS['senat-rapport-ga137']['signatures'][0]['role'],'président')
    def test_chemins_du_senat(self):
        path=IMPORT['relative_path']
        for value in ('../ppl.html','https://ailleurs.fr/ppl.html','/ppl.html','notice%2failleurs'):
            with self.subTest(value=value),self.assertRaises(ValueError):
                path(value,'leg')
        self.assertEqual(path('ppl99-128.html','leg'),'https://www.senat.fr/leg/ppl99-128.html')
