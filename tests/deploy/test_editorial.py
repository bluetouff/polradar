import importlib.util
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

path = Path(__file__).resolve().parents[2] / "scripts/editorial-collect.py"
spec = importlib.util.spec_from_file_location("editorial_collector", path)
ed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ed)


class EditorialCollection(unittest.TestCase):
    def test_primary_date_and_identity(self):
        today = date(2026, 11, 22)
        page = ed.Page(
            b'<h1>Un meeting de campagne</h1><meta property="article:published_time" content="2026-11-21T23:30:00Z">'
        )
        url = "https://campagne.example/article"
        item, _ = ed.article_at(page, url, {"campagne.example"}, "", None, today, today)
        self.assertEqual(item["date"], "2026-11-22")
        self.assertIsNone(item["event"])
        no_date = ed.Page(
            b'<h1>Un meeting de campagne</h1><meta property="article:modified_time" content="2026-11-22">'
        )
        self.assertIsNone(
            ed.article_at(
                no_date, url, {"campagne.example"}, "Autre titre", today, today, today
            )
        )
        self.assertTrue(
            ed.article_at(
                no_date,
                url,
                {"campagne.example"},
                "Un meeting de campagne",
                today,
                today,
                today,
            )
        )
        other = ed.Page(
            b'<h1>Titre du document</h1><link rel="canonical" href="https://autre.example/article">'
        )
        self.assertIsNone(
            ed.article_at(
                other,
                url,
                {"campagne.example"},
                "Titre du document",
                today,
                today,
                today,
            )
        )

    def test_plain_data_and_same_publisher_links(self):
        with self.assertRaises(ValueError):
            ed.feed_items(b"<!DOCTYPE rss><rss/>")
        self.assertIsNone(
            ed.url_for(
                "https://campagne.example/",
                "//elsewhere.example/n",
                {"campagne.example"},
            )
        )
        self.assertIsNone(
            ed.url_for(
                "https://campagne.example/", "/r?next=anything", {"campagne.example"}
            )
        )
        self.assertIsNone(
            ed.url_for("https://campagne.example/", "/%2fsecret", {"campagne.example"})
        )
        self.assertEqual(
            ed.url_for(
                "https://campagne.example/",
                "/nouveau?utm_source=test",
                {"campagne.example"},
            ),
            "https://campagne.example/nouveau",
        )
        self.assertIsNone(ed.pubday("2026-02-31"))
        self.assertEqual(
            ed.feed_items(
                b"<rss><channel><item><title>Document</title><link>https://campagne.example/a</link><pubDate>Sun, 22 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>"
            )[0][2],
            date(2026, 11, 22),
        )

    def test_empty_unavailable_and_out_of_window_search(self):
        today = date(2026, 11, 22)
        task = ("personne", '"Exemple Nom"', "Exemple Nom")
        for status, body, count in [
            (503, b"", None),
            (200, b"<html>erreur</html>", None),
            (200, b"<rss><channel/></rss>", 0),
            (
                200,
                b"<rss><channel><item><pubDate>2019-01-01</pubDate></item></channel></rss>",
                0,
            ),
        ]:
            with patch.object(
                ed.watch, "fetch", return_value=(status, "application/xml", body)
            ):
                self.assertEqual(
                    ed.search(task, today, today),
                    {
                        "id": "personne",
                        "count": count,
                        "engine": "google" if count is not None else None,
                        "leads": [],
                    },
                )

    def test_announcement_requires_the_identified_performer(self):
        import json

        today = date(2026, 11, 22)
        url = "https://campagne.example/meeting"
        obj = {
            "@type": "Event",
            "name": "Meeting à Paris",
            "datePublished": "2026-11-21",
            "startDate": "2026-12-06T14:30:00+01:00",
            "location": {
                "name": "Salle",
                "address": {"addressCountry": "FR", "addressLocality": "Paris"},
            },
            "performer": {"@type": "Person", "name": "Exemple Nom"},
        }

        def extract(event):
            page = ed.Page(
                (
                    '<h1>Meeting à Paris</h1><meta property="article:published_time" content="2026-11-21"><script type="application/ld+json">'
                    + json.dumps(event)
                    + "</script>"
                ).encode()
            )
            return ed.article_at(
                page, url, {"campagne.example"}, "", None, date(2026, 11, 20), today
            )[0]

        self.assertEqual(extract(obj)["event"]["performer"], "Exemple Nom")
        del obj["performer"]
        self.assertIsNone(extract(obj)["event"])

    def test_bing_takes_over_a_failed_index_without_opening_its_redirects(self):
        today = date(2026, 11, 22)
        rss = b"<rss><channel><item><title>Exemple Nom en meeting</title><link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fcampagne.example%2Fnews</link><pubDate>2026-11-22</pubDate></item></channel></rss>"
        with patch.object(
            ed.watch,
            "fetch",
            side_effect=[(503, "text/html", b""), (200, "application/rss+xml", rss)],
        ) as fetch:
            result = ed.search(("personne", "Exemple Nom", "Exemple Nom"), today, today)
        self.assertEqual([result["engine"], result["count"]], ["bing", 1])
        self.assertEqual(result["leads"][0]["publisher"], "campagne.example")
        self.assertIsNone(result["leads"][0]["article"])
        self.assertEqual(fetch.call_count, 2)

    def test_catches_up_an_individual_search_after_outage(self):
        recent = {
            "checkedAt": "2026-11-21T18:00:00Z",
            "hosted": {
                "queries": [{"id": "alpha", "count": 0}, {"id": "beta", "count": None}],
                "checks": [{"ok": True}],
            },
        }
        older = {
            "checkedAt": "2026-11-18T18:00:00Z",
            "candidates": ["alpha", "beta"],
            "sections": [],
        }
        self.assertEqual(
            ed.research_start(date(2026, 11, 22), [recent, older], ["alpha", "beta"]),
            date(2026, 11, 16),
        )

    def test_numbered_headings_ignore_conflicting_or_zero_numbers(self):
        source = {
            "id": "programme",
            "url": "https://campagne.example/droit",
            "kind": "parti",
        }
        page = ed.Page(
            b"<h2>Proposition 1 : Conserver le texte</h2><h2>Proposition 1 : Conserver le texte</h2><h2>Proposition 2 : Texte A</h2><h2>Proposition 2 : Texte B</h2><h2>Proposition 0 : Invalide</h2>"
        )
        today = date(2026, 11, 22)
        with patch.object(ed, "page_at", return_value=(page, source["url"])):
            self.assertEqual(
                ed.examine((source, [], [], True), today, today, {})["proposals"],
                [{"number": 1, "title": "Conserver le texte"}],
            )
