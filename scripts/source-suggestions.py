#!/usr/bin/env python3
"""Collect references proposed through the official-source issue form."""

import argparse
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
import hashlib
import http.client
import json
from pathlib import Path
import re
import runpy
import subprocess
from typing import NamedTuple
from urllib.parse import quote
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = ROOT / "src/data/sources.json"
ASSEMBLY = ROOT / "src/data/parlement/assemblee.json"
REPO = "bluetouff/polradar"
QUEUE = "source-officielle"
BATCH = 12
STATUSES = {
    "added": "source-ajoutee",
    "duplicate": "source-deja-referencee",
    "unsupported": "source-hors-perimetre",
    "format": "source-format-non-reconnu",
    "unavailable": "source-indisponible",
}
PUBLISHERS = {
    "assemblee": "Assemblée nationale",
    "senat-texte": "Sénat",
    "senat-scrutin": "Sénat",
    "insee": "Insee",
    "parlement-europeen": "Parlement européen",
}
PATTERNS = {
    "senat-texte": r"/leg/((?:pjl|ppl|ppr)[0-9]{2}-[1-9][0-9]{0,3})\.html",
    "senat-scrutin": r"/scrutin-public/([12][0-9]{3})/scr\1-([1-9][0-9]{0,3})\.html",
    "insee": r"/fr/statistiques/([1-9][0-9]{6})",
    "assemblee": r"/dyn/(1[5-7])/scrutins/([1-9][0-9]{0,5})",
}
HOST_FORMATS = {
    "www.senat.fr": ("senat-texte", "senat-scrutin"),
    "www.insee.fr": ("insee",),
    "www.assemblee-nationale.fr": ("assemblee",),
    "questions.assemblee-nationale.fr": ("assemblee",),
    "www.europarl.europa.eu": ("parlement-europeen",),
    "data.europarl.europa.eu": ("parlement-europeen",),
}
PARLIAMENT_ID = r"(TA-[1-9][0-9]?-[12][0-9]{3}-[0-9]{4})"
PROPOSAL = re.compile(r"### Adresse du document officiel\n\n(https://\S+)")
PARIS = ZoneInfo("Europe/Paris")
# Use the same TLS, public IP, redirect and response-size checks as source monitoring.
WATCH = runpy.run_path(str(ROOT / "scripts/watch-sources.py"))
EDITORIAL = runpy.run_path(str(ROOT / "scripts/editorial-collect.py"))


class Target(NamedTuple):
    provider: str
    identifier: str
    url: str


def target(raw):
    if not isinstance(raw, str) or len(raw) > 1500:
        return None
    try:
        parts = WATCH["checked_url"](raw, HOST_FORMATS)
    except ValueError:
        return None
    host, path = parts.hostname, parts.path.rstrip("/")
    for provider in HOST_FORMATS[host]:
        if provider == "parlement-europeen":
            path_format = (
                rf"/doceo/document/{PARLIAMENT_ID}_FR\.html"
                if host == "www.europarl.europa.eu"
                else rf"/eli/dl/doc/{PARLIAMENT_ID}"
            )
            if match := re.fullmatch(path_format, path):
                identifier = match[1]
                url = f"https://www.europarl.europa.eu/doceo/document/{identifier}_FR.html"
                return Target(provider, identifier, url)
        elif match := re.fullmatch(PATTERNS[provider], path):
            if provider == "assemblee":
                host = "www.assemblee-nationale.fr"
            return Target(provider, "-".join(match.groups()), f"https://{host}{path}")
    return None


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def source_id(url):
    return "source-officielle-" + digest(url)[:24]


def day(value):
    if isinstance(value, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        return date.fromisoformat(value)
    raise ValueError("Date de source invalide")


def text_at(html, class_name):
    parser = WATCH["Text"](class_name)
    parser.skip.discard("header")
    parser.feed(html.decode("utf-8", "replace"))
    parser.close()
    return " ".join(" ".join(parser.parts).split()) if parser.container_closed else ""


@lru_cache(maxsize=1)
def verified_assembly():
    data = json.loads(ASSEMBLY.read_bytes())
    return day(data["consultation"]), {
        record["id"]: record for record in data["scrutins"] + data["complementXVII"]
    }


def metadata(document, today):
    """Read the institution's title and an explicit publication date when present."""
    if document.provider != "assemblee":
        return fetch_metadata(document, today)
    legislature, number = document.identifier.split("-")
    checked, register = verified_assembly()
    record = register.get(f"VTANR5L{legislature}V{number}")
    if checked > today or not record or target(record["source"]) != document:
        return "unsupported", None
    return source_record(document, record["objet"], None, checked)


def plain_title(title):
    if not isinstance(title, str) or re.search(r"[\ufffd\ud800-\udfff]", title):
        return ""
    return EDITORIAL["safe_text"](title, maximum=500)


def source_record(document, title, published, checked):
    title = plain_title(title)
    if not title:
        return "format", None
    return "added", {
        "id": source_id(document.url),
        "title": title,
        "url": document.url,
        "publisher": PUBLISHERS[document.provider],
        "kind": "institution",
        "published": published.isoformat() if published else None,
        "checked": checked.isoformat(),
        "watch": False,
    }


def fetch_metadata(document, today):
    # Form parameters and fragments are discarded. For Europarl, build a fixed API request from the validated ID.
    url = document.url
    if document.provider == "parlement-europeen":
        url = (
            f"https://data.europarl.europa.eu/api/v2/adopted-texts/{document.identifier}"
            "?format=" + quote("application/ld+json", safe="")
        )
    host = WATCH["checked_url"](url, HOST_FORMATS).hostname
    try:
        status, mime, body, final = WATCH["fetch_reliably"](
            url, {host}, with_url=True, timeout=8
        )
    except (OSError, http.client.HTTPException):
        return "retry", None
    except ValueError:
        return "format", None
    if status in {403, 408, 429} or status >= 500:
        return "retry", None
    if status in {404, 410}:
        return "unavailable", None
    if status != 200:
        return "format", None
    published = None
    if document.provider == "parlement-europeen":
        if final != url or mime not in {"application/json", "application/ld+json"}:
            return "format", None
        try:
            records = json.loads(body)["data"]
            if not isinstance(records, list) or len(records) != 1:
                return "format", None
            record = records[0]
            if (
                record["identifier"] != document.identifier
                or record["id"] != "eli/dl/doc/" + document.identifier
                or record["publisher"] != "org/EU_PARLIAMENT"
                or record["work_type"] != "def/ep-document-types/TEXT_ADOPTED"
            ):
                return "format", None
            title = record["title_dcterms"]["fr"]
            # The document date describes the text adopted in session.
        except (KeyError, TypeError, ValueError, RecursionError):
            return "format", None
    else:
        if mime != "text/html" or target(final) != document:
            return "format", None
        if document.provider == "insee":
            title = text_at(body, "titre-titre")
            stamp = text_at(body, "date-diffusion")
            if match := re.search(r"^Paru le\b.*?([0-9]{2})/([0-9]{2})/([0-9]{4})\b", stamp):
                try:
                    published = date(int(match[3]), int(match[2]), int(match[1]))
                except ValueError:
                    return "format", None
                if published > today:
                    return "format", None
        else:
            page = EDITORIAL["Page"](body)
            headline = next((text for tag, text in page.headings if tag == "h1"), "")
            if document.provider == "senat-texte":
                if target(page.canonical) != document or page.meta.get("og:title") != headline:
                    return "format", None
                title = headline
            else:
                number = document.identifier.split("-")[1]
                if not re.fullmatch(rf"Scrutin n°\s*{number}\s*-\s*séance du .+", headline):
                    return "format", None
                title = text_at(body, "page-lead")
    return source_record(document, title, published, today)


def read_json(path, limit):
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= limit:
        raise ValueError("Fichier source hors limites")
    return json.loads(path.read_bytes())


def label_names(issue):
    labels = issue.get("labels")
    if not isinstance(labels, list):
        return []
    return [
        item["name"] for item in labels
        if isinstance(item, dict) and isinstance(item.get("name"), str)
    ]


def eligible(issue):
    return (
        isinstance(issue, dict)
        and issue.get("state") == "open"
        and "pull_request" not in issue
        and type(issue.get("number")) is int
        and 0 < issue["number"] < 2 ** 31
        and (issue.get("body") is None or isinstance(issue["body"], str))
        and QUEUE in label_names(issue)
    )


def from_body(body):
    if len(body) > 1700:
        return None
    match = PROPOSAL.fullmatch(body.replace("\r\n", "\n").strip())
    return target(match[1]) if match else None


def indexed(sources):
    return {document.url for source in sources if (document := target(source["url"]))}


def collect(issues, sources, now):
    if not isinstance(issues, list) or len(issues) > BATCH:
        raise ValueError("Candidatures de sources hors limites")
    known = indexed(sources)
    decisions, cache, counts = [], {}, Counter()
    today = now.astimezone(PARIS).date()
    for issue in issues:
        if not eligible(issue):
            continue
        body = issue.get("body") or ""
        document, source = from_body(body), None
        if not document:
            status = "unsupported"
        elif document.url in known:
            status = "duplicate"
        else:
            if document not in cache:
                cache[document] = metadata(document, today)
            status, source = cache[document]
        if status == "retry":
            created = EDITORIAL["pubday"](issue.get("created_at"))
            if not created or today - created < timedelta(days=3):
                counts["retry"] += 1
                continue
            status = "unavailable"
        decision = {"number": issue["number"], "digest": digest(body), "status": status}
        if source:
            decision["source"] = source
        decisions.append(decision)
        counts[status] += 1
    return decisions, counts


def validated_plan(rows, today):
    if not isinstance(rows, list) or len(rows) > BATCH:
        raise ValueError("Décisions de sources hors limites")
    numbers = set()
    for row in rows:
        if (
            not isinstance(row, dict)
            or not isinstance(row.get("status"), str)
            or row["status"] not in STATUSES
        ):
            raise ValueError("Décision de source invalide")
        kind = row["status"]
        keys = {"number", "digest", "status"} | ({"source"} if kind == "added" else set())
        if (
            row.keys() != keys
            or type(row["number"]) is not int
            or not 0 < row["number"] < 2 ** 31
            or row["number"] in numbers
            or not isinstance(row["digest"], str)
            or not re.fullmatch(r"[a-f0-9]{64}", row["digest"])
        ):
            raise ValueError("Identification de proposition invalide")
        numbers.add(row["number"])
        if kind != "added":
            continue
        source = row["source"]
        if not isinstance(source, dict) or source.keys() != {
            "id", "title", "url", "publisher", "kind", "published", "checked", "watch"
        }:
            raise ValueError("Référence proposée hors schéma")
        document = target(source["url"])
        title = source["title"]
        if (
            not document
            or source["url"] != document.url
            or source["id"] != source_id(document.url)
            or source["publisher"] != PUBLISHERS[document.provider]
            or source["kind"] != "institution"
            or source["watch"] is not False
            or not isinstance(title, str)
            or not title
            or plain_title(title) != title
            or not (date(1958, 1, 1) <= day(source["checked"]) <= today)
            or (source["published"] is not None and day(source["published"]) > day(source["checked"]))
        ):
            raise ValueError("Référence officielle invalide")
    return rows


def apply(rows, sources):
    known = indexed(sources)
    ids = {source["id"] for source in sources}
    additions = []
    for row in rows:
        if row["status"] != "added":
            continue
        source = row["source"]
        if source["url"] in known:
            continue
        if source["id"] in ids:
            raise ValueError("Identifiant de référence déjà employé")
        known.add(source["url"])
        ids.add(source["id"])
        additions.append(source)
    return additions


def github_issue(number, update=None):
    command = ["gh", "api", f"repos/{REPO}/issues/{number}"]
    if update is not None:
        command.extend(["--method", "PATCH", "--input", "-"])
    response = subprocess.run(
        command,
        input=json.dumps(update) if update is not None else None,
        text=True,
        capture_output=True,
        timeout=20,
        check=True,
    )
    return json.loads(response.stdout)


def matches_issue(row, issue):
    return (
        eligible(issue)
        and issue["number"] == row["number"]
        and digest(issue.get("body") or "") == row["digest"]
    )


def still_proposed(row):
    if row["status"] != "added":
        return False
    issue = github_issue(row["number"])
    if not matches_issue(row, issue):
        return False
    document = from_body(issue.get("body") or "")
    return document is not None and document.url == row["source"]["url"]


def settle(rows, sources):
    known = indexed(sources)
    errors = 0
    for row in rows:
        number, status = row["number"], row["status"]
        try:
            issue = github_issue(number)
            if not matches_issue(row, issue):
                continue
            document = from_body(issue.get("body") or "")
            if status == "added" and (
                not document or document.url != row["source"]["url"] or document.url not in known
            ):
                continue
            if status == "duplicate" and (not document or document.url not in known):
                continue
            labels = [name for name in label_names(issue) if name not in STATUSES.values()]
            github_issue(number, {
                "state": "closed",
                "state_reason": "completed" if status in {"added", "duplicate"} else "not_planned",
                "labels": [*labels, STATUSES[status]],
            })
        except (OSError, subprocess.SubprocessError, ValueError):
            errors += 1
    if errors:
        raise SystemExit(f"GitHub n’a pas confirmé {errors} décision(s). Les propositions ouvertes seront reprises.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["collect", "apply", "settle"])
    parser.add_argument("plan", type=Path)
    parser.add_argument("--issues", type=Path)
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    sources = read_json(CATALOGUE, 2 << 20)
    if args.action == "collect":
        if args.issues is None:
            parser.error("--issues est requis pour collect")
        rows, counts = collect(read_json(args.issues, 4 << 20), sources, now)
        args.plan.write_text(json.dumps(rows, ensure_ascii=False) + "\n", encoding="utf-8")
        print(json.dumps(counts, sort_keys=True))
        return
    rows = validated_plan(read_json(args.plan, 128 << 10), now.astimezone(PARIS).date())
    if args.action == "settle":
        settle(rows, sources)
    else:
        additions = apply([row for row in rows if still_proposed(row)], sources)
        if additions:
            CATALOGUE.write_text(json.dumps(sources + additions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
