"""Collect pinned France series from Eurostat's public JSON-stat API."""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import tempfile
import urllib.parse
import urllib.request
from decimal import Decimal
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
CONFIG = ROOT / "src/data/economy-series.json"
SNAPSHOT = ROOT / "src/data/economy.json"
REPORT = ROOT / "artifacts/economy-review"
LIMIT = 384 * 1024
SINCE = 2015
PERIODS = {
    "M": r"20\d{2}-(0[1-9]|1[0-2])",
    "Q": r"20\d{2}-Q[1-4]",
    "A": r"20\d{2}",
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def source_url(series):
    if not re.fullmatch(r"[a-z0-9_]{1,50}", series["dataset"]):
        raise ValueError("Identifiant Eurostat invalide")
    selectors = {"geo": "FR", "freq": series["frequency"], **series["filters"]}
    if selectors["geo"] != "FR" or selectors["freq"] != series["frequency"]:
        raise ValueError("Champ géographique ou fréquence invalide")
    params = [("lang", "FR"), ("sinceTimePeriod", str(SINCE)), *sorted(selectors.items())]
    return API + series["dataset"] + "?" + urllib.parse.urlencode(params), selectors


def indices(index, size):
    if isinstance(index, list):
        index = {code: number for number, code in enumerate(index)}
    if not isinstance(index, dict) or len(index) != size:
        raise ValueError("Index JSON-stat incohérent")
    if any(type(number) is not int for number in index.values()) or set(index.values()) != set(range(size)):
        raise ValueError("Positions JSON-stat incohérentes")
    return index


def cells(data, size):
    if isinstance(data, list) and len(data) == size:
        return dict(enumerate(data))
    if isinstance(data, dict) and all(
        re.fullmatch(r"0|[1-9]\d{0,3}", key) and int(key) < size for key in data
    ):
        return {int(key): value for key, value in data.items()}
    raise ValueError("Cellules JSON-stat incohérentes")


def parse_series(series, raw, captured):
    _, selectors = source_url(series)
    data = json.loads(raw, parse_float=Decimal)
    dimensions = data["id"]
    if (
        data.get("class") != "dataset"
        or data.get("version") != "2.0"
        or data.get("extension", {}).get("id") != series["dataset"].upper()
        or len(dimensions) != len(data["size"])
        or len(dimensions) != len(set(dimensions))
        or set(dimensions) != {*selectors, "time"}
    ):
        raise ValueError("Dimensions Eurostat inattendues")
    for axis, size in zip(dimensions, data["size"]):
        if type(size) is not int or not 1 <= size <= 300:
            raise ValueError("Taille Eurostat inattendue")
        index = indices(data["dimension"][axis]["category"]["index"], size)
        if axis == "time":
            periods = sorted(index, key=index.get)
        elif index != {selectors[axis]: 0}:
            raise ValueError("Modalité Eurostat inattendue")
    if periods != sorted(periods):
        raise ValueError("Chronologie Eurostat incohérente")
    published = dt.datetime.fromisoformat(data["updated"])
    if published.tzinfo is None or published > captured:
        raise ValueError("Horodatage Eurostat incohérent")
    values = cells(data["value"], len(periods))
    statuses = cells(data.get("status", {}), len(periods))
    observations = []
    date = captured.astimezone(ZoneInfo("Europe/Paris")).date()
    last = {
        "A": f"{date.year:04}",
        "Q": f"{date.year:04}-Q{(date.month - 1) // 3 + 1}",
        "M": f"{date.year:04}-{date.month:02}",
    }[series["frequency"]]
    for i, period in enumerate(periods):
        if not re.fullmatch(PERIODS[series["frequency"]], period) or not str(SINCE) <= period <= last:
            raise ValueError("Période Eurostat hors champ")
        flag = statuses.get(i) or ""
        if not isinstance(flag, str) or not re.fullmatch(r"[a-z: ]{0,18}", flag):
            raise ValueError("Statut Eurostat inattendu")
        value = values.get(i)
        if value is not None:
            if type(value) not in (int, Decimal) or not Decimal(value).is_finite() or abs(value) > 1e12:
                raise ValueError("Valeur Eurostat inattendue")
            value = format(Decimal(value), "f")
            if not re.fullmatch(r"-?\d{1,13}(?:\.\d{1,10})?", value):
                raise ValueError("Précision Eurostat inattendue")
        observations.append([period, value, flag])
    if not any(value is not None for _, value, _ in observations):
        raise ValueError("Série Eurostat vide")
    return {
        "id": series["id"],
        "updatedAt": published.isoformat(),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "observations": observations,
    }


def collect(series, captured):
    url, _ = source_url(series)
    request = urllib.request.Request(
        url, headers={"Accept": "application/json", "User-Agent": "Polradar/1.0 (public statistics)"}
    )
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=14) as response:
        if response.status != 200 or response.geturl() != url:
            raise ValueError("Réponse Eurostat inattendue")
        raw = response.read(LIMIT + 1)
    if len(raw) > LIMIT:
        raise ValueError("Réponse Eurostat trop volumineuse")
    return parse_series(series, raw, captured)


def write_snapshot(path, snapshot):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, delete=False
    ) as temporary:
        temporary_path = pathlib.Path(temporary.name)
        try:
            json.dump(snapshot, temporary, ensure_ascii=False, indent=2, allow_nan=False)
            temporary.write("\n")
            temporary.flush()
            os.fchmod(temporary.fileno(), 0o644)
            temporary_path.replace(path)
        finally:
            temporary_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Mettre à jour le relevé suivi par Git après une collecte complète.")
    args = parser.parse_args()
    configured = json.loads(CONFIG.read_text(encoding="utf-8"))
    previous = json.loads(SNAPSHOT.read_text(encoding="utf-8")) if SNAPSHOT.exists() else {"series": []}
    old = {row["id"]: row for row in previous["series"]}
    captured = dt.datetime.now(dt.timezone.utc)
    snapshot = {"collectedAt": captured.isoformat(timespec="seconds"), "since": SINCE, "series": []}
    lines = ["# Séries économiques Eurostat", "", f"Collecte du {snapshot['collectedAt']}", ""]
    failed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(collect, row, captured) for row in configured]
        for row, future in zip(configured, futures):
            try:
                result = future.result()
                saved = old.get(row["id"])
                if (
                    saved
                    and dt.datetime.fromisoformat(result["updatedAt"])
                    < dt.datetime.fromisoformat(saved["updatedAt"])
                ):
                    raise ValueError("Millésime antérieur au relevé publié")
            except (OSError, ValueError, KeyError, TypeError) as error:
                failed.append(row["id"])
                lines.append(f"- {row['id']} · collecte indisponible ({type(error).__name__}).")
                continue
            snapshot["series"].append(result)
            changed = not saved or result["observations"] != saved["observations"]
            period, value, flag = next(point for point in reversed(result["observations"]) if point[1] is not None)
            lines.append(f"- {row['id']} · {period} · {value} {row['unit']} · {'évolution du relevé' if changed else 'relevé identique'}.")
    REPORT.mkdir(parents=True, exist_ok=True)
    write_snapshot(REPORT / "status.json", {"checked": snapshot["collectedAt"], "failed": failed})
    if failed:
        (REPORT / "economy.json").unlink(missing_ok=True)
        lines.extend(["", "Collecte incomplète. Le relevé publié est conservé."])
    else:
        write_snapshot(REPORT / "economy.json", snapshot)
        if args.write:
            write_snapshot(SNAPSHOT, snapshot)
    (REPORT / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    if failed and args.write:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
