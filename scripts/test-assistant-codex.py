"""Évaluer des questions libres avec Codex et le MCP public de Polradar."""

import argparse
from datetime import date
import json
import os
from pathlib import Path
import re
import runpy
import statistics
import subprocess
import tempfile
import time
import unicodedata
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = runpy.run_path(str(ROOT / "scripts/test-client-codex.py"))["PUBLIC"]
SERVER = "polradar_recette"
FIXTURES = ROOT / "mcp/testdata"
PROMPT = """Réponds en français à la question à partir du seul serveur MCP Polradar. Donne une ligne de faits par élément demandé. Dans chaque champ « valeur », écris seulement la valeur courte, comme dans une cellule de tableau, sans sujet, verbe, titre ni commentaire. Conserve les seuils et unités. Dans « citations », donne l’adresse HTTPS brute d’un document fourni par l’outil, de préférence la source originale, sans lien Markdown ni paramètre ajouté. Si le registre ne couvre pas la donnée demandée, utilise le statut « indisponible » et donne une seule valeur décrivant ce manque avec l’adresse du registre.

"""
FACT = {
    "type": "object",
    "additionalProperties": False,
    "required": ["valeur", "citations"],
    "properties": {
        "valeur": {"type": "string"},
        "citations": {"type": "array", "items": {"type": "string"}},
    },
}
SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["statut", "faits"],
    "properties": {
        "statut": {"type": "string", "enum": ["documente", "indisponible"]},
        "faits": {"type": "array", "items": FACT},
    },
}


def normal(value):
    folded = unicodedata.normalize("NFKD", value.casefold().replace("’", "'"))
    text = "".join(c for c in folded if not unicodedata.combining(c))
    text = re.sub(r"\s*([<%])\s*", r"\1", text)
    return " ".join(text.split()).strip(" .:;*\x60\"«»")


FRENCH_MONTHS = (
    "janvier", "fevrier", "mars", "avril", "mai", "juin",
    "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
)
MENTIONED_DATE = re.compile(
    r"\b(?:(?P<iso>\d{4}-\d{2}-\d{2})|"
    r"(?P<day>\d{1,2}) (?P<month>" + "|".join(FRENCH_MONTHS) + r") (?P<year>\d{4}))\b"
)
OUTSIDE_COVERAGE = {
    "non couverte", "hors couverture", "hors de la couverture du registre",
    "hors registre", "hors du registre", "hors perimetre",
    "hors du perimetre du registre", "hors perimetre du registre",
    "hors du perimetre couvert par le registre",
}


def coverage_reason(value, reason):
    for match in MENTIONED_DATE.finditer(value):
        try:
            day = date.fromisoformat(match["iso"]) if match["iso"] else date(
                int(match["year"]), FRENCH_MONTHS.index(match["month"]) + 1, int(match["day"])
            )
        except ValueError:
            return False
        if day.isoformat() != reason["date"]:
            return False
    label = MENTIONED_DATE.sub("jour", value)
    label = re.sub(r"^(?:la )?(?:seance|date|periode)(?: (?:du|de|le) jour)? ", "", label)
    label = re.sub(r"^(?:le )?jour ", "", label)
    return label.removeprefix("est ") in OUTSIDE_COVERAGE


def address(value):
    if not isinstance(value, str) or len(value) > 2048 or re.search(r"[\x00-\x20\x7f\\]", value):
        return None
    try:
        url = urlsplit(value)
        if url.scheme == "https" and url.hostname and url.username is None and url.port is None:
            return (url.hostname, url.path.rstrip("/"), url.query, url.fragment)
    except ValueError:
        pass
    return None


def result_addresses(value):
    if isinstance(value, str) and (url := address(value)):
        yield url
    elif isinstance(value, dict):
        for item in value.values():
            yield from result_addresses(item)
    elif isinstance(value, list):
        for item in value:
            yield from result_addresses(item)


def at_path(value, path):
    if not path:
        yield value
        return
    current, *rest = path
    if current == "*" and isinstance(value, list):
        for child in value:
            yield from at_path(child, rest)
    elif isinstance(value, list) and re.fullmatch(r"0|[1-9][0-9]{0,8}", current):
        index = int(current)
        if index < len(value):
            yield from at_path(value[index], rest)
    elif isinstance(value, dict) and current in value:
        yield from at_path(value[current], rest)


def matches(value, want):
    if isinstance(want, dict):
        return isinstance(value, dict) and all(
            key in value and matches(value[key], item) for key, item in want.items()
        )
    return type(value) is type(want) and value == want


def load_cases():
    cases = json.loads((FIXTURES / "questions-assistant.json").read_bytes())
    corpus = json.loads((FIXTURES / "questions-documentaires.json").read_bytes())
    if cases["version"] != 1 or corpus["version"] != 1:
        raise ValueError("Version de référence inconnue.")
    for case in cases["questions"]:
        key = case["reference"]
        references = [
            row for row in corpus["questions"]
            if row["famille"] == key["famille"] and matches(row["arguments"], key["arguments"])
        ]
        if len(references) != 1:
            raise ValueError(f"Référence ambiguë pour {case['id']}.")
        ref, = references
        case["outil"] = ref["outil"]
        case["sources"] = [*ref["sources"], *case.get("adresses", [])]
        reason = case.get("motif")
        if reason is not None and (
            case["etat"] != "indisponible" or len(case["faits"]) != 1
            or reason["code"] != "hors-couverture"
            or date.fromisoformat(reason["date"]).isoformat() != reason["date"]
        ):
            raise ValueError(f"Motif documentaire invalide pour {case['id']}.")
    return cases["questions"]


def supports(case, call):
    if not call["envelope"]:
        return False
    data = call["envelope"]["donnees"]
    return any(
        call["tool"] == route.get("outil", case["outil"])
        and matches(call["arguments"], route["arguments"]) and all(
            any(matches(value, want) for value in at_path(data, path.lstrip("/").split("/")))
            for path, want in route["attendus"].items()
        )
        for route in case["appels"]
    )


def score(case, answer, calls, revisions):
    usable = [
        call for call in calls if call["envelope"] and
        (call["envelope"]["revisionDuSite"], call["envelope"]["revisionDuService"]) == revisions
    ]
    evidence = [call for call in usable if supports(case, call)]
    expected_sources = {address(source) for source in case["sources"]}
    observed_sources = set().union(*(
        set(result_addresses(call["envelope"]["donnees"])) for call in evidence
    ))
    cited_sources = (observed_sources & expected_sources) | {
        link for link in expected_sources if link and link[3] and (*link[:3], "") in observed_sources
    }
    expected = [{normal(value) for value in group} for group in case["faits"]]
    facts_ok = citations_ok = extra_facts = bad_citations = 0
    for fact in answer["faits"]:
        value = normal(fact["valeur"])
        found = next((i for i, choices in enumerate(expected) if value in choices), None)
        if found is None and expected and case.get("motif") and coverage_reason(value, case["motif"]):
            found = 0
        citations = [address(link) for link in fact["citations"]]
        wrong = sum(source not in cited_sources for source in citations)
        bad_citations += wrong
        if found is None:
            extra_facts += 1
            continue
        expected.pop(found)
        facts_ok += 1
        citations_ok += bool(citations) and not wrong
    status_ok = answer["statut"] == case["etat"]
    absent_as_known = case["etat"] == "indisponible" and answer["statut"] == "documente"
    revisions_ok = bool(usable) and len(usable) == sum(bool(call["envelope"]) for call in calls)
    return {
        "outil_et_parametres": bool(evidence),
        "revisions_conformes": revisions_ok,
        "statut_conforme": status_ok,
        "absence_reconnue": status_ok if case["etat"] == "indisponible" else None,
        "faits_attendus": len(case["faits"]),
        "faits_conformes": facts_ok,
        "faits_corrects_cites": citations_ok,
        "faits_hors_reference": extra_facts,
        "citations_sans_reference": bad_citations,
        "absence_presentee_comme_fait": absent_as_known,
        "reussi": bool(evidence and revisions_ok and status_ok and not expected and not extra_facts
                       and not bad_citations and citations_ok == facts_ok),
    }


def cli_environment():
    return {
        key: value for key, value in os.environ.items()
        if not key.startswith(("OPENAI_", "AZURE_OPENAI_")) and key != "CODEX_API_KEY"
    }


def read_turn(path):
    calls, usage = [], None
    if path.stat().st_size > 8 << 20:
        raise ValueError("Trace locale trop volumineuse.")
    for line in path.read_bytes().splitlines():
        message = json.loads(line)
        if message.get("type") == "turn.completed":
            usage = message["usage"]
        if message.get("type") != "item.completed":
            continue
        item = message["item"]
        if item["type"] == "agent_message":
            continue
        if item["type"] != "mcp_tool_call" or item["server"] != SERVER:
            raise ValueError("Action hors du serveur MCP de la recette.")
        result = item.get("result") or {}
        calls.append({
            "tool": item["tool"],
            "arguments": item["arguments"],
            "envelope": result.get("structured_content"),
            "result_bytes": len(json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode()),
        })
    if not isinstance(usage, dict):
        raise ValueError("Tour Codex incomplet.")
    return calls, {
        key: usage[key] for key in ("input_tokens", "cached_input_tokens", "output_tokens")
        if type(usage.get(key)) is int
    }


def read_answer(path):
    if not path.is_file() or path.stat().st_size > 16 << 10:
        raise ValueError("Réponse Codex absente ou trop volumineuse.")
    answer = json.loads(path.read_bytes())
    if (not isinstance(answer, dict) or answer.keys() != {"statut", "faits"}
            or answer["statut"] not in ("documente", "indisponible")
            or not isinstance(answer["faits"], list) or len(answer["faits"]) > 8):
        raise ValueError("Format de réponse Codex inattendu.")
    for fact in answer["faits"]:
        if (not isinstance(fact, dict) or fact.keys() != {"valeur", "citations"}
                or not isinstance(fact["valeur"], str) or not 0 < len(fact["valeur"]) <= 320
                or not isinstance(fact["citations"], list) or len(fact["citations"]) > 5
                or any(not isinstance(link, str) for link in fact["citations"])):
            raise ValueError("Fait de réponse mal formé.")
    return answer


def turn(question, model, env):
    with tempfile.TemporaryDirectory(prefix="polradar-assistant-") as work:
        directory = Path(work)
        schema, output, events = (directory / name for name in ("format.json", "reponse.json", "evenements.jsonl"))
        schema.write_text(json.dumps(SCHEMA), encoding="utf-8")
        command = [
            "codex", "exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules",
            "--skip-git-repo-check", "--strict-config", "--sandbox", "read-only", "--model", model,
            "--disable", "apps", "--disable", "plugins", "--disable", "hooks",
            "--disable", "shell_tool", "--disable", "shell_snapshot",
            "--disable", "multi_agent", "--disable", "multi_agent_v2", "--disable", "skill_search",
            "-c", 'approval_policy="never"', "-c", 'forced_login_method="chatgpt"',
            "-c", 'model_provider="openai"', "-c", 'model_reasoning_effort="low"',
            "-c", 'web_search="disabled"', "-c", "analytics.enabled=false",
            "-c", "hide_agent_reasoning=true",
            "-c", f"mcp_servers={{ {SERVER}={{url={json.dumps(PUBLIC)}, required=true}} }}",
            "--output-schema", str(schema), "--output-last-message", str(output), "-",
        ]
        start = time.monotonic()
        with events.open("wb") as trace:
            process = subprocess.run(command, input=PROMPT + question, text=True, cwd=work,
                                     env=env, stdout=trace, stderr=subprocess.DEVNULL, timeout=55)
        elapsed = time.monotonic() - start
        if process.returncode:
            raise ValueError("Le tour Codex n’a pas livré de réponse exploitable.")
        answer = read_answer(output)
        calls, usage = read_turn(events)
        return answer, calls, usage, round(elapsed, 3)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", required=True, help="commit à 40 caractères servi par le site")
    parser.add_argument("--revision-service", required=True, help="commit à 40 caractères servi par le MCP")
    parser.add_argument("--modele", default="gpt-6.2-sol")
    cases = load_cases()
    parser.add_argument("--cas", choices=[case["id"] for case in cases], action="append")
    args = parser.parse_args()
    revisions = (args.revision, args.revision_service)
    if any(not re.fullmatch(r"[0-9a-f]{40}", rev) for rev in revisions):
        parser.error("Les deux révisions doivent être des commits complets.")
    selected = [case for case in cases if not args.cas or case["id"] in args.cas]
    env = cli_environment()
    auth = subprocess.run(["codex", "login", "status"], env=env, capture_output=True, text=True, timeout=12)
    if auth.returncode or "chatgpt" not in (auth.stdout + auth.stderr).lower():
        parser.error("Aucune session ChatGPT existante n’a été reconnue.")
    cli = subprocess.check_output(["codex", "--version"], env=env, text=True,
                                  stderr=subprocess.DEVNULL, timeout=12).strip()
    print(json.dumps({"cli": cli, "modele": args.modele, "site": revisions[0], "service": revisions[1]}), flush=True)
    results, times = [], []
    for case in selected:
        try:
            answer, calls, usage, elapsed = turn(case["question"], args.modele, env)
            result = score(case, answer, calls, revisions)
            result.update(
                appels_mcp=len(calls), outils=sorted({call["tool"] for call in calls}),
                octets_resultats_mcp=sum(call["result_bytes"] for call in calls),
                duree_s=elapsed, jetons=usage,
            )
            times.append(elapsed)
        except (subprocess.SubprocessError, OSError, ValueError, KeyError, TypeError):
            result = {"execution": "tour indisponible ou résultat illisible", "reussi": False}
        result["cas"] = case["id"]
        results.append(result)
        print(json.dumps(result, ensure_ascii=False), flush=True)
    passed = sum(result["reussi"] for result in results)
    print(json.dumps({"reussis": passed, "cas": len(results), "latence_mediane_s": statistics.median(times) if times else None}))
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
