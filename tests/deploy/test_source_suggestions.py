import importlib.util
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch

path = Path(__file__).resolve().parents[2] / "scripts/source-suggestions.py"
spec = importlib.util.spec_from_file_location("source_suggestions", path)
suggestions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suggestions)

NOW = datetime(2026, 11, 24, 20, tzinfo=timezone.utc)
SENAT = "https://www.senat.fr/leg/ppl21-852.html"
INSEE = "https://www.insee.fr/fr/statistiques/9056956"
PARLIAMENT = "https://www.europarl.europa.eu/doceo/document/TA-9-2024-0138_FR.html"


def issue(number, url, created="2026-11-24T12:00:00Z", **extra):
    return {
        "number": number,
        "body": f"### Adresse du document officiel\n\n{url}",
        "state": "open",
        "created_at": created,
        "labels": [{"name": suggestions.QUEUE}],
        **extra,
    }


class SourceSuggestions(unittest.TestCase):
    def test_only_a_single_document_on_a_supported_official_path(self):
        submitted = [
            issue(1, "https://www.senat.fr/"),
            issue(2, "https://example.org/leg/ppl21-852.html"),
            issue(3, "http://www.senat.fr/leg/ppl21-852.html"),
            issue(4, f"{SENAT}\n\nTexte ajouté"),
            issue(5, SENAT, pull_request={}),
            issue(6, SENAT, labels=None),
        ]
        with patch.object(suggestions, "metadata") as metadata:
            rows, counts = suggestions.collect(submitted, [], NOW)
        metadata.assert_not_called()
        self.assertEqual([row["number"] for row in rows], [1, 2, 3, 4])
        self.assertEqual(counts, {"unsupported": 4})
        self.assertTrue(all(set(row) == {"number", "status", "digest"} for row in rows))

    def test_canonical_reference_uses_only_institutional_metadata(self):
        sample = (
            '<link rel="canonical" href="' + SENAT + '">'
            '<meta property="og:title" content="Titre du texte officiel">'
            '<h1>Titre du texte officiel</h1>'
        ).encode()
        first = issue(1, SENAT + "?utm_source=exemple#amendement")
        second = issue(2, SENAT)
        mock_fetch = Mock(return_value=(200, "text/html", sample, SENAT))
        with patch.dict(suggestions.WATCH, {"fetch_reliably": mock_fetch}):
            rows, counts = suggestions.collect([first, second], [], NOW)
        mock_fetch.assert_called_once_with(SENAT, {"www.senat.fr"}, with_url=True, timeout=8)
        self.assertEqual(counts, {"added": 2})
        self.assertEqual(rows[0]["source"]["title"], "Titre du texte officiel")
        self.assertEqual(rows[0]["source"]["url"], SENAT)
        self.assertIsNone(rows[0]["source"]["published"])
        self.assertFalse(rows[0]["source"]["watch"])
        suggestions.validated_plan(rows, NOW.date())
        additions = suggestions.apply(rows, [])
        self.assertEqual(len(additions), 1)
        self.assertEqual(suggestions.apply(rows, additions), [])
        with patch.object(suggestions, "metadata") as metadata:
            _, updated = suggestions.collect([first], additions, NOW)
        metadata.assert_not_called()
        self.assertEqual(updated, {"duplicate": 1})

    def test_insee_date_and_european_document_identity(self):
        actual = (
            '<h1 class="titre-titre">Indice des prix à la consommation</h1>'
            '<p class="date-diffusion">Paru le : Paru le 30/09/2026</p>'
        ).encode()
        with patch.dict(suggestions.WATCH, {
            "fetch_reliably": Mock(return_value=(200, "text/html", actual, INSEE))
        }):
            status, source = suggestions.fetch_metadata(suggestions.target(INSEE), NOW.date())
        self.assertEqual(status, "added")
        self.assertEqual(source["published"], "2026-09-30")

        document = suggestions.target(PARLIAMENT)
        record = {
            "identifier": document.identifier,
            "id": "eli/dl/doc/" + document.identifier,
            "publisher": "org/EU_PARLIAMENT",
            "work_type": "def/ep-document-types/TEXT_ADOPTED",
            "title_dcterms": {"fr": "Texte adopté par le Parlement"},
            "document_date": "2024-03-11",
        }

        def from_api(url, hosts, **_):
            self.assertEqual(hosts, {"data.europarl.europa.eu"})
            return 200, "application/ld+json", json.dumps({"data": [record]}).encode(), url

        with patch.dict(suggestions.WATCH, {"fetch_reliably": from_api}):
            status, source = suggestions.fetch_metadata(document, NOW.date())
            self.assertEqual(status, "added")
            self.assertIsNone(source["published"])
            record["identifier"] = "TA-9-2024-0139"
            self.assertEqual(suggestions.fetch_metadata(document, NOW.date()), ("format", None))

    def test_retry_window_and_refusal_of_invalid_plan_fields(self):
        with patch.object(suggestions, "metadata", return_value=("retry", None)):
            rows, counts = suggestions.collect(
                [issue(1, INSEE), issue(2, INSEE, "2026-11-20T12:00:00Z")], [], NOW
            )
        self.assertEqual(counts, {"retry": 1, "unavailable": 1})
        self.assertEqual(rows[0]["number"], 2)
        suggestions.validated_plan(rows, NOW.date())
        for bad in [
            {**rows[0], "number": True},
            {**rows[0], "status": []},
            {**rows[0], "body": "Contenu soumis"},
        ]:
            with self.assertRaises(ValueError):
                suggestions.validated_plan([bad], NOW.date())

    def test_an_edited_issue_is_rechecked_before_publication_and_closure(self):
        original = issue(1, SENAT)
        source = suggestions.source_record(
            suggestions.target(SENAT), "Titre du document", None, NOW.date()
        )[1]
        row = {
            "number": 1,
            "digest": suggestions.digest(original["body"]),
            "status": "added",
            "source": source,
        }
        changed = issue(1, INSEE)
        with patch.object(suggestions, "github_issue", return_value=changed) as github:
            self.assertFalse(suggestions.still_proposed(row))
            suggestions.settle([row], [source])
        self.assertEqual([call.args for call in github.call_args_list], [(1,), (1,)])
        with patch.object(suggestions, "github_issue", return_value=original) as github:
            self.assertTrue(suggestions.still_proposed(row))
            suggestions.settle([row], [])
            self.assertEqual([call.args for call in github.call_args_list], [(1,), (1,)])
            suggestions.settle([row], [source])
            self.assertEqual(
                github.call_args.args,
                (1, {
                    "state": "closed",
                    "state_reason": "completed",
                    "labels": [suggestions.QUEUE, "source-ajoutee"],
                }),
            )
