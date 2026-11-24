import importlib.util
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("editorial_sitemaps", ROOT / "scripts/editorial-collect.py")
ed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ed)
HOST = "campagne.example"
BASE = "https://" + HOST
MAP = BASE + "/sitemap.xml"
PREFIX = "/actualites/"
RULE = {"url": MAP, "articles": PREFIX}
DAY = date(2026, 11, 24)
SINCE = date(2026, 11, 20)


def xml(rows):
    root = ET.Element(ed.SITEMAP_NS + "urlset")
    for url, modified in rows:
        item = ET.SubElement(root, ed.SITEMAP_NS + "url")
        ET.SubElement(item, ed.SITEMAP_NS + "loc").text = url
        if modified:
            ET.SubElement(item, ed.SITEMAP_NS + "lastmod").text = modified
    return ET.tostring(root, encoding="utf-8")


class OfficialSitemaps(unittest.TestCase):
    def test_declared_sections_belong_to_existing_editorial_origins(self):
        origins = json.loads((ROOT / "scripts/editorial-origins.json").read_text())
        sources = {s["id"]: s for s in json.loads((ROOT / "src/data/sources.json").read_text())}
        for sid, rule in origins["sitemaps"].items():
            source = sources[sid]
            host = ed.urlsplit(source["url"]).hostname
            self.assertIn(source["kind"], {"campagne", "parti", "institution"})
            self.assertEqual(ed.watch.checked_url(rule["url"], {host}).hostname, host)
            self.assertIn(sid, origins["announcements"]["breves"])
            self.assertRegex(rule["articles"], r"^/[a-z0-9-]+/$")

    def test_bounded_urlsets_only_return_articles_in_the_declared_section(self):
        ok = BASE + PREFIX + "politique-de-sante"
        other = BASE + PREFIX + "actualité"
        rows = [(url, DAY.isoformat()) for url in [
            ok, ok, other, BASE + "/equipe/a", BASE + PREFIX, BASE + PREFIX + "a/b",
            BASE + PREFIX + "%2e%2e", BASE + PREFIX + "%252fprive", BASE + PREFIX + "a.pdf",
            "http://" + HOST + PREFIX + "a", "https://autre.example" + PREFIX + "a",
            "https://utilisateur@" + HOST + PREFIX + "a", ok + "?p=1", ok + "#p",
            "https://" + HOST + ":443" + PREFIX + "a", "/actualites/relative",
        ]]
        rows.extend([(BASE + PREFIX + "sans-date", None), (BASE + PREFIX + "ancien", "2018-01-01")])
        found = ed.sitemap_items(xml(rows), HOST, PREFIX, SINCE, DAY)
        self.assertEqual(set(found), {ok, BASE + PREFIX + "actualit%C3%A9", BASE + PREFIX + "sans-date"})
        self.assertEqual(found[BASE + PREFIX + "sans-date"], date.min)
        for unsafe in [
            b'<!DOCTYPE urlset><urlset/>', b'\xff\xfe<\0', b"<html/>",
            xml([]) + b" " * ed.SITEMAP_BYTES,
            xml([(ok, None)] * (ed.SITEMAP_ENTRIES + 1)),
            b'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap/></sitemapindex>',
        ]:
            with self.subTest(sample=unsafe[:35]), self.assertRaises((ValueError, ET.ParseError)):
                ed.sitemap_items(unsafe, HOST, PREFIX, SINCE, DAY)

    def test_inventory_304_is_used_only_after_every_lead_is_already_registered(self):
        dest = BASE + PREFIX + "position"
        payload = xml([(dest, DAY.isoformat())])
        calls = []

        def transport(url, hosts, **options):
            calls.append(options["conditional"])
            options["response_meta"].update(entity=ed.watch.http_cache.key(url), etag='"edition"')
            return (304, "", b"", url) if options["conditional"] else (200, "application/xml", payload, url)

        with tempfile.TemporaryDirectory() as tmp:
            state = ed.watch.http_cache.State(Path(tmp) / "http.json")
            with patch.object(ed.watch, "STATE", state), patch.object(ed.watch, "fetch", side_effect=transport):
                issues = set()
                self.assertEqual(set(ed.discover_sitemap(RULE, BASE, SINCE, DAY, {}, set(), issues)), {dest})
                self.assertFalse(state.get("sitemap-v1", MAP))
                registered = {dest: ("Titre sourcé", DAY.isoformat())}
                for _ in range(2):
                    ed.discover_sitemap(RULE, BASE, SINCE, DAY, registered, set(), issues)
                ed.discover_sitemap(RULE, BASE, SINCE, DAY, registered, {dest}, issues)
                registered[dest] = ("Autre titre", DAY.isoformat())
                ed.discover_sitemap(RULE, BASE, SINCE, DAY, registered, set(), issues)
                self.assertEqual([bool(c) for c in calls], [False, False, True, False, False])
                self.assertFalse(issues)

    def test_separate_dates_one_request_per_article_and_shared_request_budget(self):
        dated, undated = [BASE + PREFIX + slug for slug in ("annonce", "sans-date")]
        feed = BASE + "/feed.xml"
        seed = BASE + "/index"
        source = {"id": "origine", "kind": "campagne", "url": seed}
        title = "Un programme pour la campagne présidentielle"
        base = ('<link rel="alternate" type="application/rss+xml" href="/feed.xml">'
                '<a href="' + dated + '">' + title + '</a>').encode()
        items = "".join(
            '<item><title>' + title + '</title><link>' + url +
            '</link><pubDate>2026-11-24</pubDate></item>' for url in (dated, undated)
        )
        rss = ('<rss><channel>' + items + '</channel></rss>').encode()
        payload = xml([(url, DAY.isoformat()) for url in [dated, undated] +
                       [BASE + PREFIX + "autre-" + str(i) for i in range(20)]])
        checked = []

        def transport(url, hosts, **options):
            checked.append(url)
            if url == seed:
                result = (200, "text/html", base)
            elif url == feed:
                result = (200, "application/rss+xml", rss)
            elif url == MAP:
                result = (200, "text/xml", payload)
            else:
                body = '<h1>' + title + '</h1>'
                if url == dated:
                    body += '<meta property="article:published_time" content="2026-11-23">'
                else:
                    body += '<meta property="article:modified_time" content="2026-11-24">'
                result = (200, "text/html", body.encode())
            return (*result, url) if options.get("with_url") else result

        with patch.object(ed.watch, "fetch", side_effect=transport):
            result = ed.examine((source, [], ["breves"], False), SINCE, DAY, {}, official_index=True, sitemap=RULE)
        self.assertTrue(result["ok"])
        self.assertEqual([(x["url"], x["date"]) for x in result["publications"]], [(dated, "2026-11-23")])
        self.assertEqual(checked.count(dated), 1)
        self.assertEqual(checked.count(undated), 1)
        self.assertLessEqual(sum(PREFIX in u for u in checked), 5)

    def test_unavailable_or_untrusted_map_does_not_interrupt_the_base_origin(self):
        seed, article = BASE + "/index", BASE + PREFIX + "base"
        source = {"id": "origine", "kind": "parti", "url": seed}
        title = "Un programme pour la campagne présidentielle"
        for status, rule, issue in [
            (429, RULE, "limite-editeur"), (500, RULE, "flux-indisponible"),
            (200, {"url":"https://autre.example/sitemap.xml", "articles": PREFIX}, "flux-indisponible"),
        ]:
            visited = []

            def transport(url, hosts, **options):
                visited.append(url)
                if url == MAP:
                    return status, "text/xml", b"", url
                self.assertIn(url, (seed, article))
                body = ('<a href="' + article + '">' + title + '</a>' if url == seed else
                        '<h1>' + title + '</h1><meta property="article:published_time" content="2026-11-23">')
                return 200, "text/html", body.encode(), url

            with patch.object(ed.watch, "fetch", side_effect=transport):
                row = ed.examine((source, [], ["breves"], False), SINCE, DAY, {}, official_index=True, sitemap=rule)
            self.assertEqual(row["issues"], [issue])
            self.assertEqual([a["url"] for a in row["publications"]], [article])
            self.assertNotIn("https://autre.example/sitemap.xml", visited)
