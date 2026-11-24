#!/usr/bin/env python3
"""Find recent publications. External pages are data; nothing from them is executed."""

from concurrent.futures import ThreadPoolExecutor
import argparse
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
import http.client
import importlib.util
import json
from pathlib import Path
import re
import time
import unicodedata
from urllib.parse import parse_qsl, quote, unquote, urlencode, urljoin, urlsplit, urlunsplit
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "source_watch", ROOT / "scripts/watch-sources.py"
)
watch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watch)
PARIS = ZoneInfo("Europe/Paris")
SOCIAL = {
    "x.com",
    "twitter.com",
    "youtube.com",
    "youtu.be",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "drive.google.com",
    "docs.google.com",
    "assets.nationbuilder.com",
}
CAMPAIGN = re.compile(
    r"\b(presidentielle|campagne|candidat\w*|investiture|programme|proposition\w*|meeting|reunion publique|deplacement|parrainage\w*|scrutin|chiffrage|budget|refus de se presenter)\b"
)
NEWS = "news.google.com"
SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
SITEMAP_BYTES = 256 * 1024
SITEMAP_ENTRIES = 1000
SITEMAP_ARTICLES = 2


def read(name):
    return json.loads((ROOT / "src/data" / f"{name}.json").read_text())


def flat(value):
    return " ".join(str(value or "").split())


def folded(value):
    s = unicodedata.normalize("NFKD", flat(value).casefold())
    return " ".join(
        re.findall(r"[a-z0-9]+", "".join(c for c in s if not unicodedata.combining(c)))
    )


def safe_text(s, maximum=220):
    s = flat(s)
    return (
        s
        if 2 <= len(s) <= maximum
        and not re.search(r"[<>\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]", s)
        else ""
    )


def url_for(base, value, hosts):
    if not isinstance(value, str) or not value or value.startswith("#"):
        return None
    try:
        p = watch.checked_url(urljoin(base, value), hosts)
        if len(p.path) > 900 or re.search(r"%(?:2f|5c|0[ad])", p.path, re.I):
            return None
        if any(
            k not in {"p", "page_id", "article", "id_article", "id", "lang"}
            and not k.startswith("utm_")
            for k, _ in parse_qsl(p.query, keep_blank_values=True)
        ):
            return None
        q = urlencode(
            [(k, v) for k, v in parse_qsl(p.query) if not k.startswith("utm_")]
        )
        return urlunsplit(
            (
                "https",
                p.hostname,
                quote(p.path or "/", safe="/%:@-._~!$&()*+,;="),
                q,
                "",
            )
        )
    except (ValueError, UnicodeError):
        return None


def pubday(s):
    if not isinstance(s, str) or not s:
        return None
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
            return date.fromisoformat(s)
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            d = parsedate_to_datetime(s)
        if d and d.tzinfo:
            return d.astimezone(PARIS).date()
    except (TypeError, ValueError, OverflowError):
        pass
    return None


class Page(HTMLParser):
    def __init__(self, body):
        super().__init__(convert_charrefs=True)
        self.meta, self.links, self.feeds, self.jsonld, self.headings = (
            {},
            [],
            [],
            [],
            [],
        )
        self.canonical = self.tag = self.jsontext = self.anchor = None
        self.words = []
        self.feed(body.decode("utf-8", "replace"))
        self.close()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta":
            self.meta[(a.get("property") or a.get("name") or "").lower()] = (
                a.get("content") or ""
            )
        if tag == "link":
            rel = (a.get("rel") or "").lower().split()
            if "canonical" in rel:
                self.canonical = a.get("href")
            if "alternate" in rel and (a.get("type") or "").lower() in (
                "application/rss+xml",
                "application/atom+xml",
            ):
                self.feeds.append(a.get("href"))
        if tag == "a":
            self.anchor = [a.get("href"), []]
        if tag in ("h1", "h2", "h3", "h4", "h5"):
            self.tag, self.words = tag, []
        if (
            tag == "script"
            and (a.get("type") or "").strip().lower() == "application/ld+json"
        ):
            self.jsontext = []

    def handle_data(self, s):
        if self.jsontext is not None:
            self.jsontext.append(s)
        elif self.tag:
            self.words.append(s)
        if self.anchor:
            self.anchor[1].append(s)

    def handle_endtag(self, tag):
        if tag == "a" and self.anchor:
            self.links.append((self.anchor[0], flat(" ".join(self.anchor[1]))))
            self.anchor = None
        if tag == self.tag:
            self.headings.append((tag, flat(" ".join(self.words))))
            self.tag = None
        if tag == "script" and self.jsontext is not None:
            raw = "".join(self.jsontext)
            self.jsontext = None
            if len(raw) < 160000 and len(self.jsonld) < 80:
                try:
                    obj = json.loads(raw)
                    nodes = obj if isinstance(obj, list) else [obj]
                    for n in nodes[:80]:
                        if isinstance(n, dict):
                            self.jsonld.append(n)
                            if isinstance(n.get("@graph"), list):
                                self.jsonld.extend(
                                    x for x in n["@graph"][:80] if isinstance(x, dict)
                                )
                except (ValueError, RecursionError):
                    pass


def feed_items(body, with_publisher=False):
    # Reject XML with declarations of entities or a non-UTF-8 encoding of those markers.
    if b"\0" in body or re.search(rb"<!\s*(?:doctype|entity)\b", body, re.I):
        raise ValueError("XML interdit")
    root = ET.fromstring(body)
    if root.tag.split("}")[-1] not in ("rss", "feed", "RDF"):
        raise ValueError("Flux non reconnu")
    out = []
    for n in root.iter():
        if n.tag.split("}")[-1] not in ("item", "entry"):
            continue
        row = {}
        for child in n:
            key = child.tag.split("}")[-1]
            if key == "link" and child.get("rel", "alternate") != "alternate":
                continue
            row[key] = (
                (child.get("href") if key == "link" else None) or child.text or ""
            )
            if key == "source":
                row["origin"] = child.get("url", "")
        item = (
            row.get("link", ""),
            flat(row.get("title")),
            pubday(row.get("pubDate") or row.get("published") or row.get("date")),
        )
        out.append((*item, row.get("origin", "")) if with_publisher else item)
        if len(out) == 150:
            break
    return out


def sitemap_article(raw, host, prefix):
    if not isinstance(raw, str) or not raw.startswith("https://") or len(raw) > 1200:
        return None
    try:
        parts = watch.checked_url(raw, {host})
    except (ValueError, UnicodeError):
        return None
    if parts.query or parts.fragment or not parts.path.startswith(prefix):
        return None
    # These publishers use one slug per article. A decoded slash, dot or second
    # layer of percent-encoding cannot broaden the configured section.
    slug = unquote(parts.path[len(prefix):].removesuffix("/"))
    if not re.fullmatch(r"[\w-]{1,300}", slug):
        return None
    return url_for(raw, raw, {host})


def sitemap_items(body, host, prefix, since, today):
    if len(body) > SITEMAP_BYTES:
        raise ValueError("Sitemap trop volumineux")
    xml = body.decode("utf-8-sig")
    if "\0" in xml or re.search(r"<!\s*(?:doctype|entity)\b", xml, re.I):
        raise ValueError("Déclaration XML interdite")
    root = ET.fromstring(xml)
    if root.tag != SITEMAP_NS + "urlset" or len(root) > SITEMAP_ENTRIES:
        raise ValueError("Sitemap hors périmètre")
    found = {}
    for row in root.findall(SITEMAP_NS + "url"):
        locs = row.findall(SITEMAP_NS + "loc")
        if len(locs) != 1 or not locs[0].text:
            continue
        dest = sitemap_article(locs[0].text.strip(), host, prefix)
        modified = pubday(row.findtext(SITEMAP_NS + "lastmod"))
        if not dest or (modified and not since <= modified <= today):
            continue
        # lastmod only orders discovery. It is never sent to article_at.
        found[dest] = max(found.get(dest, date.min), modified or date.min)
    return found


def discover_sitemap(rule, seed, since, today, registered, ongoing, issues):
    host = urlsplit(seed).hostname
    try:
        if not isinstance(rule, dict) or not isinstance(rule.get("articles"), str):
            raise ValueError("Sitemap non déclaré")
        endpoint, prefix = rule.get("url"), rule["articles"]
        parts = watch.checked_url(endpoint, {host})
        if (parts.query or parts.fragment or not parts.path.endswith(".xml")
                or not re.fullmatch(r"/[a-z0-9-]+/", prefix)):
            raise ValueError("Périmètre du sitemap invalide")
        context = watch.http_cache.key(json.dumps([
            prefix, since.isoformat(), today.isoformat(), sorted(registered.items()), sorted(ongoing),
        ]))
        stored = watch.STATE.get("sitemap-v1", endpoint)
        conditional = stored if stored.get("digest") == context else None
        meta = {}
        status, mime, body, resolved = watch.fetch(
            endpoint, {host}, with_url=True, timeout=6,
            conditional=conditional, response_meta=meta,
        )
        if resolved != endpoint:
            raise ValueError("Autre sitemap")
        if status == 304 and conditional:
            return {}
        if status == 429:
            issues.add("limite-editeur")
            return {}
        if status != 200 or mime not in ("application/xml", "text/xml"):
            raise ValueError("Sitemap indisponible")
        found = sitemap_items(body, host, prefix, since, today)
        # Validators cannot hide an unprocessed or unpublished lead on a rerun.
        if meta and all(u in registered and u not in ongoing for u in found):
            watch.STATE.remember("sitemap-v1", endpoint, meta, context)
        return found
    except (ValueError, OSError, http.client.HTTPException, ET.ParseError, RecursionError):
        issues.add("flux-indisponible")
        return {}


def search(task, since, today):
    ident, query, person = task
    providers = [
        (
            "google",
            NEWS,
            "/rss/search?",
            {
                "q": f"{query} after:{(since - timedelta(days=1)).isoformat()}",
                "hl": "fr",
                "gl": "FR",
                "ceid": "FR:fr",
            },
        ),
        (
            "bing",
            "www.bing.com",
            "/news/search?",
            {"q": query, "format": "rss", "setlang": "fr-FR", "mkt": "fr-FR"},
        ),
    ]
    for engine, hostname, path, params in providers:
        try:
            code, _, body = watch.fetch(
                "https://" + hostname + path + urlencode(params), {hostname}, timeout=9
            )
            if code != 200:
                continue
            rows = sorted(
                (r for r in feed_items(body, True) if r[2] and since <= r[2] <= today),
                key=lambda r: r[2],
                reverse=True,
            )
            leads = []
            for link, title, published, origin in rows:
                parsed = urlsplit(link)
                publisher = urlsplit(origin).hostname or ""
                article = None
                if engine == "google":
                    if (
                        parsed.scheme != "https"
                        or parsed.netloc != NEWS
                        or not re.fullmatch(
                            r"/rss/articles/[A-Za-z0-9_-]{12,800}", parsed.path
                        )
                    ):
                        continue
                    article = parsed.path.rsplit("/", 1)[-1]
                else:
                    if (
                        parsed.hostname != "www.bing.com"
                        or parsed.path != "/news/apiclick.aspx"
                    ):
                        continue
                    dest = dict(parse_qsl(parsed.query)).get("url", "")
                    publisher = urlsplit(dest).hostname or ""
                if (
                    safe_text(title)
                    and re.fullmatch(r"[a-z0-9.-]{3,180}", publisher)
                    and (not person or folded(person) in folded(title))
                ):
                    leads.append(
                        {
                            "title": title,
                            "date": published.isoformat(),
                            "article": article,
                            "publisher": publisher,
                        }
                    )
                if len(leads) == 2:
                    break
            return {"id": ident, "count": len(rows), "engine": engine, "leads": leads}
        except (
            OSError,
            http.client.HTTPException,
            ValueError,
            ET.ParseError,
            RecursionError,
        ):
            continue
    return {"id": ident, "count": None, "engine": None, "leads": []}


def host_set(url):
    host = urlsplit(url).hostname
    if host.removeprefix("www.") in SOCIAL:
        return {host}
    return {host, host.removeprefix("www."), "www." + host.removeprefix("www.")}


def page_at(url, hosts, timeout=10):
    status, mime, body, resolved = watch.fetch(
        url, hosts, with_url=True, timeout=timeout
    )
    if status != 200 or mime not in ("text/html", "application/xhtml+xml"):
        raise ValueError("Page indisponible")
    return Page(body), resolved


def article_at(page, address, hosts, feed_title, feed_date, since, today):
    canonical = url_for(
        address, page.canonical or page.meta.get("og:url") or address, hosts
    )
    if (
        not canonical
        or urlsplit(canonical).path in ("", "/")
        and not urlsplit(canonical).query
    ):
        return None
    resolved = urlsplit(address)
    if (
        urlsplit(canonical).path.rstrip("/") != resolved.path.rstrip("/")
        or urlsplit(canonical).query != resolved.query
    ):
        return None
    title = safe_text(
        next((s for tag, s in page.headings if tag == "h1"), "")
        or page.meta.get("og:title")
    )
    if not title:
        return None
    published = pubday(page.meta.get("article:published_time"))
    event = None
    for n in page.jsonld:
        types = n.get("@type")
        types = types if isinstance(types, list) else [types]
        identity = n.get("url") or n.get("mainEntityOfPage")
        if isinstance(identity, dict):
            identity = identity.get("@id")
        if identity and url_for(address, identity, hosts) != canonical:
            continue
        if any(
            t
            in (
                "Article",
                "NewsArticle",
                "BlogPosting",
                "ReportageNewsArticle",
                "PressRelease",
            )
            for t in types
        ):
            if folded(n.get("headline")) == folded(title):
                published = published or pubday(n.get("datePublished"))
        if "Event" in types and folded(n.get("name")) == folded(title):
            loc = n.get("location")
            addr = loc.get("address") if isinstance(loc, dict) else None
            country = addr.get("addressCountry") if isinstance(addr, dict) else None
            status = str(n.get("eventStatus") or "").rsplit("/", 1)[-1]
            start = n.get("startDate")
            who = n.get("performer") or n.get("performers")
            performers = [
                p.get("name")
                for p in (who if isinstance(who, list) else [who])
                if isinstance(p, dict)
                and p.get("@type") == "Person"
                and safe_text(p.get("name"), 100)
            ]
            if (
                country in ("FR", "France")
                and isinstance(start, str)
                and re.fullmatch(
                    r"\d{4}-\d\d-\d\d(?:T\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d))?",
                    start,
                )
            ):
                if (
                    pubday(start)
                    and len(performers) == 1
                    and status
                    in ("", "EventScheduled", "EventCancelled", "EventRescheduled")
                ):
                    event = {
                        "start": start,
                        "status": status or "EventScheduled",
                        "performer": performers[0],
                        "city": safe_text(addr.get("addressLocality"), 100),
                        "venue": safe_text(loc.get("name"), 180),
                    }
                    published = published or pubday(n.get("datePublished"))
    if not published and feed_date and folded(feed_title) == folded(title):
        published = feed_date
    if not published or not since <= published <= today:
        return None
    return {
        "url": canonical,
        "title": title,
        "date": published.isoformat(),
        "event": event,
    }, flat(page.meta.get("description") or page.meta.get("og:description"))[:600]


def examine(task, since, today, hints, scheduled=None, *, official_index=False, registered=None, sitemap=None):
    s, persons, desks, programme = task
    seed, sid = s["url"], s["id"]
    hosts = host_set(seed)
    host = urlsplit(seed).hostname
    row = {"source": sid, "url": None, "ok": False, "publications": [], "proposals": []}
    if host.removeprefix("www.") in SOCIAL or s["kind"] == "archive":
        return row
    # On shared infrastructure stay inside the registered institutional index.
    entry = (
        f"https://{host}/"
        if persons and s["kind"] in ("campagne", "parti") and not programme and not official_index
        else seed
    )
    row["url"] = entry
    issues = set()
    try:
        page, home = page_at(entry, hosts)
        row["ok"] = True
        if programme:
            numbered = {}
            for tag, heading in page.headings:
                m = re.fullmatch(
                    r"Proposition\s+(?:n[°º]\s*)?(\d{1,3})\s*[:.·–—-]\s*(.+)",
                    heading,
                    re.I,
                )
                if m and tag != "h1" and int(m[1]) > 0 and safe_text(m[2], 170):
                    numbered.setdefault(int(m[1]), set()).add(m[2])
            row["proposals"] = [
                {"number": n, "title": next(iter(titles))}
                for n, titles in numbered.items()
                if len(titles) == 1
            ][:65]
            if not persons and not desks:
                return row
        links = {}
        for raw in page.feeds[:1]:
            feed = url_for(home, raw, hosts)
            if not feed:
                continue
            try:
                meta = {}
                # A feed can change even when its HTML home does not.
                context = watch.http_cache.key(json.dumps([since.isoformat(), today.isoformat(), sorted(registered or {})]))
                stored = watch.STATE.get('feed-v1', feed)
                conditions = stored if stored.get('digest') == context else None
                options = {'conditional':conditions, 'response_meta':meta} if watch.STATE.path else {}
                status, _, body = watch.fetch(feed, hosts, timeout=8, **options)
                if status == 304 and conditions:
                    continue
                if status != 200:
                    issues.add('limite-editeur' if status == 429 else 'flux-indisponible')
                    continue
                complete = True
                for url, title, day in feed_items(body):
                    dest = url_for(home, url, hosts)
                    if dest and day and since <= day <= today:
                        links.setdefault(dest, (title, day))
                        complete = complete and dest in (registered or {}) and dest not in (scheduled or ())
                if complete and meta:
                    watch.STATE.remember('feed-v1', feed, meta, context)
            except (
                ValueError,
                OSError,
                http.client.HTTPException,
                ET.ParseError,
                RecursionError,
            ):
                issues.add('flux-indisponible')
        for raw, text in page.links:
            if len(text) < 16 or len(text) > 240:
                continue
            dest = url_for(home, raw, hosts)
            if dest and (
                CAMPAIGN.search(folded(text))
                or any(folded(name) in folded(text) for _, name in persons)
                or not persons
                and len(text) > 34
            ):
                links.setdefault(dest, (text, None))
        used = set()
        ongoing = set(scheduled or ())
        map_links = (
            discover_sitemap(sitemap, seed, since, today, registered or {}, ongoing, issues)
            if sitemap and s["kind"] in ("campagne", "parti", "institution") else {}
        )

        def consider(doc, url, label="", when=None, article_hosts=hosts):
            result = article_at(
                doc,
                url,
                article_hosts,
                label,
                when,
                date.min if url in ongoing else since,
                today,
            )
            if not result:
                return
            article, deck = result
            if article["url"] in used:
                return
            if article["date"] < since.isoformat() and (
                article["url"] not in ongoing or not article["event"]
            ):
                return
            mentioned = [
                i
                for i, name in persons
                if folded(name) in folded(article["title"] + " " + deck)
            ]
            if persons and not (
                mentioned and CAMPAIGN.search(folded(article["title"] + " " + deck))
            ):
                return
            article["candidates"] = mentioned
            row["publications"].append(article)
            used.add(article["url"])

        consider(page, home)

        def priority(item):
            title = folded(item[1][0])
            return (
                any(
                    title and (title in h or h in title)
                    for h in hints.get(host.removeprefix("www."), [])
                ),
                any(folded(name) in title for _, name in persons),
                item[1][1] is not None,
            )

        deadline = time.monotonic() + 30
        for dest in sorted(ongoing):
            links.setdefault(dest, ("", None))
        selected = sorted(
            links.items(),
            key=lambda pair: (pair[0] in ongoing, priority(pair)),
            reverse=True,
        )
        if map_links:
            # Keep all scheduled events and the leading feed/home choices. Share
            # the existing five-article budget rather than adding another crawl.
            front = max(len(ongoing), 3)
            ordered = [url for url, _ in selected]
            from_map = sorted(
                map_links, key=lambda url: (url not in (registered or {}), map_links[url]),
                reverse=True,
            )
            extra = [url for url in from_map if url != home and url not in ordered[:front]]
            ordered[front:front] = extra[:SITEMAP_ARTICLES]
            selected = [(url, links.get(url, ("", None))) for url in dict.fromkeys(ordered)]
        for dest, (label, when) in selected[:5]:
            if time.monotonic() >= deadline:
                break
            if dest == home or re.search(
                r"\.(?:pdf|jpe?g|png|zip|mp[34])$", urlsplit(dest).path, re.I
            ):
                continue
            try:
                article_hosts = {host} if dest in map_links else hosts
                if dest in map_links:
                    when = None
                if watch.STATE.path and registered and dest in registered and dest not in ongoing:
                    # Only records already in the published corpus can use a 304 shortcut.
                    meta = {}
                    stored = watch.STATE.get('article-v1', dest)
                    context = watch.http_cache.key(json.dumps([dest, *registered[dest]]))
                    conditions = stored if stored.get('digest') == context else None
                    status, mime, body, resolved = watch.fetch(dest, article_hosts, with_url=True, timeout=min(9, deadline-time.monotonic()), conditional=conditions, response_meta=meta)
                    if status == 304 and conditions:
                        continue
                    if status != 200 or mime not in ('text/html', 'application/xhtml+xml'):
                        if status == 429: issues.add('limite-editeur')
                        raise ValueError('Article indisponible')
                    doc = Page(body)
                    detail = article_at(doc, resolved, article_hosts, label, when, date.min, today)
                    if detail and meta:
                        article = detail[0]
                        if article['url'] == dest and article['event'] is None and (article['title'], article['date']) == registered[dest]:
                            watch.STATE.remember('article-v1', dest, meta, context)
                else:
                    doc, resolved = page_at(dest, article_hosts, min(9, deadline - time.monotonic()))
                if dest in map_links and not sitemap_article(resolved, host, sitemap["articles"]):
                    continue
                consider(doc, resolved, label, when, article_hosts)
            except (ValueError, OSError, http.client.HTTPException, RecursionError):
                issues.add('article-indisponible')
                continue
    except (ValueError, OSError, http.client.HTTPException, RecursionError):
        pass
    if issues:
        row['issues'] = sorted(issues)
    return row


def research_start(today, history, query_ids):
    # A single unavailable search gets the same catch-up window as a missed day.
    last_success = {}
    last_sources = None
    for review in sorted(history, key=lambda r: r["checkedAt"], reverse=True):
        day = pubday(review["checkedAt"])
        hosted = review.get("hosted")
        if not day or day > today:
            continue
        if hosted:
            successful = [q["id"] for q in hosted["queries"] if q["count"] is not None]
            sources_ok = any(c["ok"] for c in hosted["checks"])
        else:
            successful = review["candidates"] + [
                s["id"] for s in review["sections"] if s["status"] != "indisponible"
            ]
            sources_ok = bool(successful)
        for key in successful:
            last_success.setdefault(key, day)
        if sources_ok and last_sources is None:
            last_sources = day
    earliest = min(
        [last_sources or today] + [last_success.get(key, today) for key in query_ids]
    )
    return max(today - timedelta(days=30), earliest - timedelta(days=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--announcements-only', action='store_true')
    parser.add_argument('--cache', type=Path)
    args = parser.parse_args()
    watch.configure_cache(args.cache)
    now = datetime.now(timezone.utc)
    today = now.astimezone(PARIS).date()
    config = json.loads((ROOT / "scripts/editorial-origins.json").read_text())
    people = {c["id"]: c for c in read("candidates") if not c.get("withdrawnOn")}
    documents = {s["id"]: s for s in read("sources")}
    upcoming = {}
    for event in read("campaign-agenda")["events"]:
        if (
            re.fullmatch(r"rdv-[a-f0-9]{20}", event["id"])
            and event["date"] >= today.isoformat()
            and event["status"] != "tenu"
        ):
            upcoming.setdefault(event["candidate"], []).append(
                documents[event["source"]]["url"]
            )
    history = read("editorial-reviews")
    since = research_start(today, history, [*people, *config["sections"]])
    plan = {}
    for cid, c in people.items():
        for sid in config["candidates"].get(cid, [c["statusSource"]]):
            plan.setdefault(sid, [[], []])[0].append((cid, c["name"]))
    for desk, d in config["sections"].items():
        for sid in d["sources"]:
            plan.setdefault(sid, [[], []])[1].append(desk)
    for sid in config.get("programmes", {}):
        plan.setdefault(sid, [[], []])
    tasks = [
        (documents[sid], persons, desks, sid in config.get("programmes", {}))
        for sid, (persons, desks) in plan.items()
    ]
    selected = {sid for ids in config["announcements"].values() for sid in ids}
    if args.announcements_only:
        tasks = [(origin, persons, desks, False) for origin, persons, desks, _ in tasks
                 if origin['id'] in selected and origin['kind'] in ('campagne', 'parti', 'institution')]
    queries = [
        (
            cid,
            '"' + c["name"] + '" (présidentielle OR campagne OR programme OR meeting)',
            c["name"],
        )
        for cid, c in people.items()
    ] + [(desk, d["query"], None) for desk, d in config["sections"].items()]
    # Search hits help identify the corresponding article on the publisher's own site.
    results = []
    hints = {}
    for task in ([] if args.announcements_only else queries):
        result = search(task, since, today)
        results.append(result)
        for lead in result["leads"]:
            hints.setdefault(lead["publisher"].removeprefix("www."), []).append(
                folded(lead["title"].rsplit(" - ", 1)[0])
            )
        time.sleep(1)
    published_ids = {sid for ev in read("events") for sid in ev["sources"]}
    published_urls = {s["url"]: (s["title"], s.get("published")) for s in documents.values()
                      if s["id"] in published_ids and s["id"].startswith("ed-src-")}
    with ThreadPoolExecutor(max_workers=6) as pool:

        def review_site(task):
            origin, persons, _, _ = task
            hosts = host_set(origin["url"])
            sitemap = config.get("sitemaps", {}).get(origin["id"])
            scheduled = [
                url
                for cid, _ in persons
                for url in upcoming.get(cid, [])
                if urlsplit(url).hostname in hosts
            ]
            # Preserve a candidate homepage already monitored in the daily run
            # when its site is also added to the announcements edition.
            use_index = origin["id"] in selected and not (
                isinstance(sitemap, dict) and sitemap.get("startAtHomepage") is True
            )
            return examine(
                task, since, today, hints, scheduled, official_index=use_index,
                registered=published_urls, sitemap=sitemap,
            )

        checks = list(pool.map(review_site, tasks))
    watch.STATE.save()
    output = {
        "scope": "annonces" if args.announcements_only else "complete",
        "checkedAt": datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z"),
        "since": since.isoformat(),
        "queries": results,
        "checks": checks,
    }
    target = ROOT / "artifacts/editorial/edition.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    print(
        f"{sum(q['count'] is not None for q in results)}/{len(results)} recherches et {sum(c['ok'] for c in checks)}/{len(checks)} points de départ accessibles."
    )


if __name__ == "__main__":
    main()
