import json
from pathlib import Path
import runpy
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
BENCH = runpy.run_path(str(ROOT / "scripts/test-assistant-codex.py"))
CASES = {case["id"]: case for case in BENCH["load_cases"]()}
REVISIONS = ("1" * 40, "2" * 40)
NOTICE = "https://www.commission-des-sondages.fr/notices/medias/fichiers/add/2352"
ARCHIVES = "https://polradar.fr/api/parlement/archives/index.json"


def call(arguments, data):
    return {
        "tool": "polradar_donnees",
        "arguments": arguments,
        "envelope": {
            "revisionDuSite": REVISIONS[0], "revisionDuService": REVISIONS[1],
            "donnees": data,
        },
    }


def answer(status, *facts):
    return {
        "statut": status,
        "faits": [{"valeur": value, "citations": links} for value, links in facts],
    }


class AssistantBenchmark(unittest.TestCase):
    def test_supported_case_can_require_a_specific_array_entry(self):
        data = {"publication": {"rules": [{"refs": [{"label": "LCEN, art. 30 I"}]},
                                          {"refs": [{"label": "LCEN, art. 30 II"}]}]}}
        args = {"collection": "droit", "id": "outils-chiffres"}
        case = CASES["droit-chiffrement-repere"]
        self.assertTrue(BENCH["supports"](case, call(args, data)))
        data["publication"]["rules"].reverse()
        self.assertFalse(BENCH["supports"](case, call(args, data)))
        self.assertEqual(list(BENCH["at_path"]([0], ["2"])), [])

    def test_threshold_and_notice_are_scored_separately(self):
        source = call(
            {"collection": "sondages", "id": "opinionway-commission-10333-p12"},
            {"publication": {"id": "opinionway-commission-10333-p12", "usefulSample": 680,
                             "results": [{"id": "arthaud", "percentage": None, "below": 1}]},
             "source": {"url": NOTICE}},
        )
        correct = answer("documente", ("<1 %", [NOTICE + "#page=12"]), ("680 personnes", [NOTICE]))
        report = BENCH["score"](CASES["sondage-seuil"], correct, [source], REVISIONS)
        self.assertTrue(report["reussi"])
        self.assertEqual(report["faits_corrects_cites"], 2)

        wrong = answer("documente", ("1 %", [NOTICE]), ("680", ["https://exemple.invalid/notice"]))
        report = BENCH["score"](CASES["sondage-seuil"], wrong, [source], REVISIONS)
        self.assertFalse(report["reussi"])
        self.assertEqual(report["faits_conformes"], 1)
        self.assertEqual(report["faits_hors_reference"], 1)
        self.assertEqual(report["citations_sans_reference"], 1)

        wrong_page = answer("documente", ("<1 %", [NOTICE + "#page=13"]), ("680", [NOTICE]))
        report = BENCH["score"](CASES["sondage-seuil"], wrong_page, [source], REVISIONS)
        self.assertFalse(report["reussi"])
        self.assertEqual(report["citations_sans_reference"], 1)

    def test_absence_must_be_tied_to_its_period_and_revision(self):
        data = {"periodeDemandee": "2024-03-18", "couverture": "periode-non-couverte",
                "publication": None, "index": ARCHIVES}
        relevant = call({"collection": "parlement-europeen", "periode": "2024-03-18"}, data)
        text = answer("indisponible", ("date non couverte", [ARCHIVES]))
        report = BENCH["score"](CASES["seance-hors-registre"], text, [relevant], REVISIONS)
        self.assertTrue(report["reussi"])
        self.assertTrue(report["absence_reconnue"])
        for wording in (
            "Séance du 18 mars 2024 hors couverture",
            "La date du 2024-03-18 est hors du périmètre du registre",
        ):
            revised = answer("indisponible", (wording, [ARCHIVES]))
            self.assertTrue(BENCH["score"](CASES["seance-hors-registre"], revised, [relevant], REVISIONS)["reussi"])
        for wording in (
            "Séance du 19 mars 2024 hors couverture",
            "Séance hors couverture, vote contre",
            "Pas de vote nominatif à cette date",
        ):
            revised = answer("indisponible", (wording, [ARCHIVES]))
            self.assertFalse(BENCH["score"](CASES["seance-hors-registre"], revised, [relevant], REVISIONS)["reussi"])
        report = BENCH["score"](CASES["seance-hors-registre"], text, [relevant], ("3" * 40, REVISIONS[1]))
        self.assertFalse(report["revisions_conformes"])
        self.assertFalse(report["outil_et_parametres"])

        wrong_period = call({"collection": "parlement-europeen", "periode": "2024-03-19"}, data)
        self.assertFalse(BENCH["score"](CASES["seance-hors-registre"], text, [wrong_period], REVISIONS)["reussi"])
        invented = answer("documente", ("contre", [ARCHIVES]))
        report = BENCH["score"](CASES["seance-hors-registre"], invented, [relevant], REVISIONS)
        self.assertTrue(report["absence_presentee_comme_fait"])
        self.assertFalse(report["reussi"])

    def test_vote_fields_must_belong_to_same_person(self):
        data = {"publication": {"id": "VTANR5L17V9916",
                                "positions": [{"candidat": "attal", "vote": "contre", "delegation": False},
                                              {"candidat": "autre", "vote": "pour", "delegation": True}]}}
        observed = call({"collection": "parlement"}, data)
        self.assertFalse(BENCH["supports"](CASES["vote-cyber"], observed))

    def test_turn_rejects_wrong_server_and_malformed_answers(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.json"
            path.write_text(json.dumps({"type": "item.completed",
                                        "item": {"type": "mcp_tool_call", "server": "autre"}}))
            with self.assertRaises(ValueError):
                BENCH["read_turn"](path)
            path.write_text('{"statut":"documente","faits":[{"valeur":7,"citations":[]}]}')
            with self.assertRaises(ValueError):
                BENCH["read_answer"](path)
