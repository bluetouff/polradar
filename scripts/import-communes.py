#!/usr/bin/env python3
"""Import the checked 2022 election files and the Insee territorial comparator."""

import argparse
import csv
import hashlib
import io
import json
import re
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
OUTPUT = ROOT / "public" / "data" / "communes" / "2022"
CODE = re.compile(r"(?:[0-9]{2}|2[AB])[0-9]{3}")
# The Ministry prefixes its overseas records with two-letter electoral codes.
# Every resulting code is also checked against the 2022 COG.
OVERSEAS = {
    "ZA": ("971",), "ZB": ("972",), "ZC": ("973",), "ZD": ("974",),
    "ZM": ("976",), "ZS": ("975",), "ZX": ("977", "978"),
    "ZN": ("988",), "ZP": ("987",),
}
ELECTION_FIELDS = ["Inscrits", "Votants", "Blancs", "Nuls", "Exprimés", "Abstentions"]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def csv_rows(path, encoding="utf-8", delimiter=","):
    with path.open(encoding=encoding, newline="") as stream:
        yield from csv.DictReader(stream, delimiter=delimiter)


def ballot(row, header, candidates):
    require(len(row) == len(header) + 7 * len(candidates) - 7, "Largeur du bulletin")
    fields = dict(zip(header, row))
    require(fields["Etat saisie"] == "Complet", "Saisie incomplète")
    registered, turnout, blank, invalid, expressed, abstained = (
        int(fields[name]) for name in ELECTION_FIELDS
    )
    choices = [row[offset:offset + 7] for offset in range(header.index("N°Panneau"), len(row), 7)]
    require([tuple(choice[:4]) for choice in choices] == candidates, "Ordre ou identité des candidats")
    votes = [int(choice[4]) for choice in choices]
    require(
        registered >= turnout >= 0 and min(blank, invalid, expressed, abstained, *votes) >= 0
        and turnout + abstained == registered and sum(votes) == expressed
        and blank + invalid + expressed == turnout,
        f"Totaux incohérents : {row[:4]}",
    )
    return [registered, turnout, blank, invalid, *votes]


def load_election(source, round_number, geography):
    national = source / f"t{round_number}-fe.txt"
    with national.open(encoding="cp1252", newline="") as stream:
        header, total = list(csv.reader(stream, delimiter=";"))
    candidates = [
        tuple(total[offset:offset + 4]) for offset in range(header.index("N°Panneau"), len(total), 7)
    ]
    require(
        len(candidates) == (12 if round_number == 1 else 2)
        and len({candidate[0] for candidate in candidates}) == len(candidates)
        and total[0] == "FE",
        "Résultat France entière incomplet",
    )
    national_counts = ballot(total, header, candidates)
    communes, excluded, totals, seen = {}, defaultdict(int), [0] * len(national_counts), set()
    excluded_counts = [0] * len(national_counts)
    with (source / f"t{round_number}-subcom.txt").open(encoding="cp1252", newline="") as stream:
        reader = csv.reader(stream, delimiter=";")
        header = next(reader)
        for row in reader:
            district, _, local, name = row[:4]
            require((district, local) not in seen, f"Doublon : {district}/{local}")
            seen.add((district, local))
            counts = ballot(row, header, candidates)
            totals = [a + b for a, b in zip(totals, counts)]
            if district in {"ZW", "ZZ"}:
                excluded[district] += 1
                excluded_counts = [a + b for a, b in zip(excluded_counts, counts)]
                continue
            prefixes = OVERSEAS.get(district)
            code = (prefixes[0][:2] if prefixes else district) + local
            require(
                CODE.fullmatch(code) and code in geography and code not in communes
                and (not prefixes or code[:3] in prefixes),
                f"Identifiant COG absent ou incohérent : {district}/{code}",
            )
            communes[code] = (name, counts)
    require(totals == national_counts, f"Totaux France entière non réconciliés au tour {round_number}")
    return communes, dict(excluded), national_counts, excluded_counts, [
        f"{given} {surname.title()}" for _, _, surname, given in candidates
    ]


def stable_geography(path):
    # The versioned workbook contains COM, fusions and scissions on sheets 3–5.
    # Check the field labels in each sheet before accepting any coordinates.
    with ZipFile(path) as archive, ZipFile(
        io.BytesIO(archive.read("table_passage_annuelle_2026.xlsx"))
    ) as workbook:
        shared = [
            "".join(t.text or "" for t in cell.findall(".//{*}t"))
            for cell in ET.fromstring(workbook.read("xl/sharedStrings.xml"))
        ]

        def rows(sheet, columns):
            with workbook.open(f"xl/worksheets/sheet{sheet}.xml") as stream:
                for _, row in ET.iterparse(stream, events=("end",)):
                    if row.tag.endswith("}row"):
                        values = {}
                        for cell in row:
                            column = cell.attrib["r"].rstrip("0123456789")
                            value = cell.find("{*}v")
                            if column in columns and value is not None:
                                values[column] = shared[int(value.text)] if cell.get("t") == "s" else value.text
                        yield values
                        row.clear()

        forwards, backwards, changed = defaultdict(set), defaultdict(set), set()
        primary = rows(3, {"A", "AN", "AV"})
        for row in primary:
            if row.get("A") == "NIVGEO":
                break
        else:
            raise ValueError("Colonnes du COG absentes")
        require(row["AN"] == "CODGEO_2022" and row["AV"] == "CODGEO_2026", "Millésimes du COG")
        for row in primary:
            if row.get("A") != "COM":
                continue
            old, new = row.get("AN"), row.get("AV")
            if old and new:
                require(CODE.fullmatch(old) and CODE.fullmatch(new), "Lien COG invalide")
                forwards[old].add(new)
                backwards[new].add(old)
        for sheet in (4, 5):
            changes = rows(sheet, {"A", "B", "C"})
            for row in changes:
                if row.get("A") == "ANNEE_MODIF":
                    break
            else:
                raise ValueError("Colonnes des modifications du COG absentes")
            require(row["B"] == "COM_INI" and row["C"] == "COM_FIN", "Colonnes des modifications du COG")
            for row in changes:
                if row.get("A", "").isdigit() and int(row["A"]) > 2022:
                    changed.update((row["B"], row["C"]))
    return {
        old: new
        for old, links in forwards.items()
        for new in links
        if len(links) == 1 and len(backwards[new]) == 1 and old not in changed and new not in changed
    }


def local_context(path, codes):
    measures = {
        ("DS_RP_SERIE_HISTORIQUE", "POP"): ("population", "NR"),
        ("DS_RP_LOGEMENT_PRINC", "DWELLINGS"): ("logements", ""),
        ("DS_RP_LOGEMENT_PRINC", "DWELLINGS_OCS_DW_VAC"): ("vacants", ""),
    }
    context = defaultdict(dict)
    with ZipFile(path) as archive, archive.open("comparateur.csv") as stream:
        for row in csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8"), delimiter=";"):
            if row["GEO_OBJECT"] != "COM" or row["TIME_PERIOD"] != "2023" or row["GEO"] not in codes:
                continue
            source = measures.get((row["DS"], row["TAB_MEASURE"]))
            if source is None or row["OBS_STATUS"] != "A":
                continue
            name, unit = source
            require(row["GEO_REF"] == "2026" and row["UNIT_MEASURE"] == unit
                    and not row["UNIT_MULT"] and not row["CONF_STATUS"], "Géographie, unité ou diffusion Insee")
            value = Decimal(row["OBS_VALUE"])
            require(value.is_finite() and 0 <= value <= 100_000_000, "Valeur Insee invalide")
            values = context[row["GEO"]]
            require(name not in values, "Doublon Insee")
            if name == "population":
                require(value == value.to_integral_value(), "Population non entière")
            values[name] = int(value) if name == "population" else float(value)
    result = {}
    for code, values in context.items():
        if {"population", "logements", "vacants"} <= values.keys():
            require(values["vacants"] <= values["logements"], "Logements vacants hors plage")
            result[code] = [values["population"], values["logements"], values["vacants"]]
    return result


def write_rows(path, rows):
    path.write_text(
        "[\n" + ",\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in rows) + "\n]\n",
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sources", type=Path)
    source = parser.parse_args().sources
    provenance = json.loads((DATA / "communes-2022-sources.json").read_text(encoding="utf-8"))
    for item in provenance:
        path = source / item["file"]
        require(path.stat().st_size == item["bytes"], f"Taille inattendue : {path.name}")
        with path.open("rb") as stream:
            require(hashlib.file_digest(stream, "sha256").hexdigest() == item["sha256"], f"SHA-256 inattendu : {path.name}")
    geography = {
        row["COM"] for row in csv_rows(source / "commune_2022.csv") if row["TYPECOM"] == "COM"
    } | {
        row["COM_COMER"] for row in csv_rows(source / "com_comer_2022.csv") if row["NATURE_ZONAGE"] == "COM"
    }
    first, excluded, first_total, first_excluded, first_candidates = load_election(source, 1, geography)
    final, excluded_final, final_total, final_excluded, final_candidates = load_election(source, 2, geography)
    require(first.keys() == final.keys() and excluded == excluded_final, "Périmètres électoraux divergents")
    stable = stable_geography(source / "passage.zip")
    census = local_context(source / "comparateur.zip", {stable[code] for code in first.keys() & stable.keys()})
    index, shards, covered = [], defaultdict(list), 0
    for code, (name, counts) in sorted(first.items()):
        require(final[code][0] == name, f"Nom différent entre les tours : {code}")
        context = census.get(stable.get(code))
        covered += context is not None
        index.append([code, name])
        shards[code[:2]].append([code, counts, final[code][1], context])
    preview_code = "75056"
    meta = {
        "count": len(index),
        "withContext": covered,
        "excluded": {"foreign": excluded["ZZ"], "wallisFutuna": excluded["ZW"]},
        "rounds": [
            {"date": "2022-04-10", "candidates": first_candidates, "national": first_total, "excluded": first_excluded},
            {"date": "2022-04-24", "candidates": final_candidates, "national": final_total, "excluded": final_excluded},
        ],
        "preview": {
            "name": first[preview_code][0],
            "record": next(record for record in shards[preview_code[:2]] if record[0] == preview_code),
        },
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    write_rows(OUTPUT / "index.json", index)
    for prefix, rows in shards.items():
        write_rows(OUTPUT / f"{prefix}.json", rows)
    (DATA / "communes-2022.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(index)} communes, dont {covered} avec indicateurs Insee. Deux tours réconciliés.")


if __name__ == "__main__":
    main()
