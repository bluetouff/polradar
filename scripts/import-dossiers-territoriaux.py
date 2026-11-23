"""Rebuild the published territorial editions from verified official input files."""
import argparse
import csv
import hashlib
import json
import math
import re
import zipfile
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "sru.csv": "f4405d1c042693687a8b8352264e4282327d2e2e1409fceac5224abbaa99f893",
    "apl.xlsx": "21c73deff57dc7a83a3cd6fcfd5b5ceb8c7a40e98590a50b5b1194f2dd4d75a2",
    "departements.geojson": "2a766d5c163988e7851447406eda266dd9edbc58754199b3dffc62832eba3b19",
    "geo-communes.json": "ff005233253a1694142f08e3362fedebb2b489c73e5c12ef7842f881e77369f6",
    "geo.json": "f2b5f93b288effd230d0ae5e1f721a741d4ba2984389090d03d241519459c4f9",
}
CODE = re.compile(r"(?:\d{2}|2[AB])\d{3}")
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def flag(value):
    return {"1": True, "0": False, "": None}[value]


def inventory(path, names):
    result = {}
    with path.open(encoding="cp1252", newline="") as source:
        for row in csv.DictReader(source, delimiter=";"):
            code = row["Code_INSEE_commune"]
            if not CODE.fullmatch(code) or code in result:
                raise ValueError(f"Code SRU invalide ou dupliqué : {code}")
            names.setdefault(code, row["Nom_commune"])
            total = row["Nombre_lls_ Inventaire_au_01_01_2025"].strip()
            rate = row["Taux_SRU_au_01_01_2025"].strip()
            if rate not in {"", "Entrée au dispositif", ">25%"} and not re.fullmatch(r"\d+(,\d+)?%", rate):
                raise ValueError(f"Taux SRU inconnu : {rate}")
            result[code] = {
                "inventory": None if total in {"", "Pas d'inventaire"} else int(total),
                "rate": rate or None,
                "target": int(row["Taux_cible_commune"].removesuffix("%")),
                "inScope": flag(row["Commune_sru_au_01_01_2026"]),
                "deficit": flag(row["commune_deficitaire_au_01-01-2025"]),
                "carence": flag(row["Commune_carencee_2023_2025"]),
                "exempt": flag(row["Commune_exemptee_2026_2028"]),
            }
    return result


def precision(value):
    # The DREES cells have three decimals followed by Excel binary artefacts.
    return Decimal(value).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def accessibility(path, names):
    by_code, by_dep = {}, defaultdict(lambda: [Decimal(0), Decimal(0)])
    cities = {"75056": range(75101, 75121), "69123": range(69381, 69390), "13055": range(13201, 13217)}
    weights = {}
    with zipfile.ZipFile(path) as book:
        strings = ["".join(el.itertext()) for el in ElementTree.fromstring(book.read("xl/sharedStrings.xml"))]
        for row in ElementTree.fromstring(book.read("xl/worksheets/sheet4.xml")).iter(NS + "row"):
            cells = {}
            for cell in row.iter(NS + "c"):
                key = cell.get("r").rstrip("0123456789")
                value = cell.findtext(NS + "v")
                cells[key] = strings[int(value)] if value and cell.get("t") == "s" else value
            code = cells.get("A") or ""
            if not CODE.fullmatch(code):
                continue
            if code in by_code:
                raise ValueError(f"Doublon DREES : {code}")
            names.setdefault(code, cells["B"])
            apl = precision(cells["C"])
            weight = precision(cells["G"])
            if min(apl, weight) < 0:
                raise ValueError(f"Valeur DREES négative : {code}")
            by_code[code] = float(apl)
            weights[code] = (apl * weight, weight)
            dep = code[:3] if code.startswith("97") else code[:2]
            by_dep[dep][0] += apl * weight
            by_dep[dep][1] += weight
    for city, districts in cities.items():
        if city in by_code:
            raise ValueError(f"Double comptage ville/arrondissements : {city}")
        parts = [weights[str(code)] for code in districts]
        by_code[city] = float(precision(sum(n for n, _ in parts) / sum(d for _, d in parts)))
    return by_code, {k: float(precision(n / d)) for k, (n, d) in by_dep.items() if d}


def polygons(feature):
    geometry = feature["geometry"]
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] != "MultiPolygon":
        raise ValueError("Géométrie départementale inattendue")
    return geometry["coordinates"]


def map_paths(features, departments, averages):
    visible = {f["properties"]["code"]: polygons(f) for f in features if f["properties"]["code"] in departments}
    if set(visible) != set(departments) or set(averages) - set(visible):
        raise ValueError("Département sans fond cartographique")
    overseas = ["971", "972", "973", "974", "976"]
    groups = [([k for k in visible if k not in overseas], (10, 12, 370, 380))]
    groups += [([code], (409, 11 + 79 * i, 88, 49)) for i, code in enumerate(overseas)]
    rows = []
    for codes, (left, top, width, height) in groups:
        points = [p for c in codes for poly in visible[c] for ring in poly for p in ring]
        xmin, xmax = min(p[0] for p in points), max(p[0] for p in points)
        ymin, ymax = min(p[1] for p in points), max(p[1] for p in points)
        cosine = math.cos(math.radians((ymin + ymax) / 2))
        scale = min(width / ((xmax - xmin) * cosine), height / (ymax - ymin))
        def point(p):
            x = left + width / 2 + (p[0] - (xmin + xmax) / 2) * cosine * scale
            y = top + height / 2 - (p[1] - (ymin + ymax) / 2) * scale
            return f"{x:.1f},{y:.1f}"
        for code in codes:
            rings = []
            for poly in visible[code]:
                for ring in poly:
                    rings.append("M" + " ".join(point(p) for p in ring[:-1]) + "Z")
            rows.append({"code": code, "name": departments[code], "value": averages.get(code), "path": "".join(rings)})
    return sorted(rows, key=lambda r: r["code"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", type=Path)
    args = parser.parse_args()
    for filename, expected in FILES.items():
        if hashlib.sha256((args.inputs / filename).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Édition différente, à vérifier : {filename}")
    def read(name):
        return json.loads((args.inputs / name).read_bytes())
    names = {row["code"]: row["nom"] for row in read("geo-communes.json")}
    departments = {r["code"]: r["nom"] for r in read("geo.json")}
    sru = inventory(args.inputs / "sru.csv", names)
    apl, averages = accessibility(args.inputs / "apl.xlsx", names)
    shapes = map_paths(read("departements.geojson")["features"], departments, averages)
    # The electoral search already distributes most of these code/name pairs.
    base_file = ROOT / "public/data/communes/2022/index.json"
    if hashlib.sha256(base_file.read_bytes()).hexdigest() != "f25f9b415acb98cd407307832819fae0b74c874800b18e38877ac716b4afd992":
        raise ValueError("L’index de référence des communes a changé.")
    baseline = dict(json.loads(base_file.read_bytes()))
    directory = {
        "removed": sorted(baseline.keys() - names.keys()),
        "entries": sorted((code, name) for code, name in names.items() if baseline.get(code) != name),
    }
    output = ROOT / "src/data/territoires"
    output.mkdir(exist_ok=True)
    for name, data in (("annuaire", directory), ("sru", sru), ("apl", apl), ("departements", shapes)):
        (output / (name + ".json")).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(sru)} lignes SRU, {len(apl)-3} observations DREES, 3 agrégats de ville, {len(averages)} moyennes départementales.")


if __name__ == "__main__":
    main()
