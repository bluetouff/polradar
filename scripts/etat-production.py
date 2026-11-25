"""Contrôle les versions, outils et collections servis par les interfaces publiques."""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener

SITE = "https://polradar.fr"
GITHUB = "https://api.github.com/repos/bluetouff/polradar"
SHA = re.compile(r"[a-f0-9]{40}")
LIMIT = 3 * 1024 * 1024
SURFACES = (
    "index.html", "statistiques/index.html", "recherche/index.html", "comparer/index.html",
    "sondages/index.html", "api/corpus.json", "api/recherche.json", "api/exports-v1.json",
    "api/qualite-documentaire.json", "data/enquetes.json", "data/choix-suivi.json",
    "rss.xml", "breves/rss.xml", "sitemap.xml",
)
LEGACY = "2025-11-25"
CURRENT = "2026-07-28"
TOOLS = {
    "polradar_candidates": {},
    "polradar_changements": {"kind": "programme"},
    "polradar_comparer": {"question": "fiscalite-csg-salaires", "candidates": ["attal", "glucksmann"]},
    "polradar_corpus": {},
    "polradar_donnees": {"collection": "sondages"},
    "polradar_measure": {"id": "herlin-semaine-40-heures"},
    "polradar_methodologie": {},
    "polradar_question": {"id": "fiscalite-csg-salaires"},
    "polradar_search": {"query": "suppression de la CSG", "limit": 3},
    "polradar_territoires": {"code": "75056"},
    "polradar_votes": {},
}
COLLECTIONS = (
    "agenda", "arcom", "breves", "budgets", "droit", "economie", "financements",
    "graphiques", "marches", "parlement", "parlement-europeen", "senat",
    "sondages", "sources", "verifications",
)


class DirectHTTPS(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = build_opener(DirectHTTPS())


def fetch(address, envelope=None, extra=None, expected=200):
    headers = {"User-Agent": "Polradar-etat-public/1"}
    data = None
    if envelope is not None:
        headers.update({"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
        data = json.dumps(envelope).encode()
    headers.update(extra or {})
    try:
        with opener.open(Request(address, data=data, headers=headers), timeout=15) as response:
            if response.status != expected or response.geturl() != address:
                raise ValueError(f"Réponse HTTP {response.status}, attendu {expected}")
            raw = response.read(LIMIT + 1)
            if len(raw) > LIMIT:
                raise ValueError("Réponse trop volumineuse")
            return json.loads(raw) if expected == 200 else None
    except HTTPError as exc:
        raise ValueError(f"Réponse HTTP {exc.code}") from None


def rpc(method, params, version=LEGACY, notify=False):
    headers = {"MCP-Protocol-Version": version}
    if version == CURRENT:
        headers["Mcp-Method"] = method
        if method == "tools/call":
            headers["Mcp-Name"] = params["name"]
        params = {**params, "_meta": {
            "io.modelcontextprotocol/protocolVersion": version,
            "io.modelcontextprotocol/clientCapabilities": {},
        }}
    envelope = {"jsonrpc": "2.0", "method": method, "params": params}
    if not notify:
        envelope["id"] = 1
    reply = fetch(SITE + "/api/mcp", envelope, headers, 202 if notify else 200)
    if notify:
        return None
    if reply.get("error"):
        raise ValueError(f"Erreur JSON-RPC {reply['error'].get('code')}")
    result = reply.get("result")
    if not isinstance(result, dict):
        raise ValueError("Résultat MCP absent")
    if result.get("isError"):
        raise ValueError("Erreur signalée par l’outil")
    return result


def advertised_tools(version):
    tools = rpc("tools/list", {}, version)["tools"]
    if (sorted(t["name"] for t in tools) != sorted(TOOLS)
            or not all(t.get("annotations", {}).get("readOnlyHint") is True
                       and t["annotations"].get("destructiveHint") is False for t in tools)):
        raise ValueError("Catalogue actif ou annotations de lecture seule différents du contrat")
    return [{"nom": t["name"], "lectureSeule": True} for t in tools]


def verify_call(name, arguments, corpus, version=LEGACY):
    result = rpc("tools/call", {"name": name, "arguments": arguments}, version)
    value = result.get("structuredContent")
    if (not isinstance(value, dict) or value.get("sansResultat") is not False
            or any(value.get(key) != corpus[key] for key in
                   ("versionContrat", "revisionDuSite", "revisionDuService"))):
        raise ValueError("Données absentes ou provenance incohérente")
    return value["donnees"]


def extended_probe(corpus):
    results = {}
    for name, args in TOOLS.items():
        try:
            verify_call(name, args, corpus)
            results[name] = {"etat": "ok"}
        except (ValueError, KeyError, TypeError) as exc:
            results[name] = {"etat": "erreur", "detail": str(exc)}
    collections = {}
    for name in COLLECTIONS:
        try:
            rows = verify_call("polradar_donnees", {"collection": name}, corpus)
            if rows["collection"] != name or not rows["publications"] or rows["total"] < 1:
                raise ValueError("Liste vide ou collection différente")
            collections[name] = {"etat": "ok", "total": rows["total"]}
        except (ValueError, KeyError, TypeError) as exc:
            collections[name] = {"etat": "erreur", "detail": str(exc)}
    return {"outils": results, "collections": collections}


def verify_surfaces(marker, counts):
    expected = marker.get("sha256")
    if expected is not None and (not isinstance(expected, dict) or set(expected) != set(SURFACES)):
        raise ValueError("Inventaire des surfaces différent du manifeste")
    results = {}
    observed_polls = None
    declared_polls = None
    for path in SURFACES:
        url = SITE + "/" + path.removesuffix("index.html")
        with opener.open(Request(url, headers={"Cache-Control": "no-cache"}), timeout=15) as response:
            if response.status != 200 or response.geturl() != url:
                raise ValueError(f"Surface publique indisponible : {path}")
            raw = response.read(10 * 1024 * 1024 + 1)
            if len(raw) > 10 * 1024 * 1024:
                raise ValueError(f"Surface trop volumineuse : {path}")
            digest = hashlib.sha256(raw).hexdigest()
            if expected is not None and digest != expected[path]:
                raise ValueError(f"Empreinte de publication différente : {path}")
            results[path] = {
                "octets": len(raw), "sha256": digest,
                "etag": response.headers.get("ETag"),
                "modifie": response.headers.get("Last-Modified"),
                "cache": response.headers.get("Cache-Control"),
            }
        if path == "statistiques/index.html":
            total = re.search(rb'data-proposal-total="(\d+)"', raw)
            if not total or int(total[1]) != counts["campagne"] + counts["parti"]:
                raise ValueError("Nombre de propositions différent entre statistiques et REST")
        if path == "index.html":
            assets = sorted(set(re.findall(rb'"/(_astro/[A-Za-z0-9_.-]+\.(?:css|js))"', raw)))
            if not assets or b'http-equiv="content-security-policy"' not in raw:
                raise ValueError("Ressources ou CSP de l’accueil manquantes")
            for asset in assets:
                with opener.open(Request(SITE + "/" + asset.decode("ascii"), method="HEAD"), timeout=10) as resource:
                    if resource.status != 200:
                        raise ValueError("Ressource compilée indisponible")
            results[path]["ressourcesControlees"] = len(assets)
        if path == "api/corpus.json":
            dataset = json.loads(raw)
            scopes = {"campagne": "campagne", "parti": "parti",
                      "orientation": "orientations", "archive": "archives"}
            for scope, key in scopes.items():
                if sum(item["scope"] == scope for item in dataset["measures"]) != counts[key]:
                    raise ValueError(f"Nombre de fiches différent entre corpus et REST : {scope}")
            if len(dataset["sources"]) != counts["sources"]:
                raise ValueError("Nombre de sources différent entre corpus et REST")
        if path == "data/enquetes.json":
            polls = json.loads(raw)["polls"]
            observed_polls = {
                "observations": len(polls),
                "documentedSurveys": len({row["surveyId"] for row in polls if row.get("surveyId")}),
                "firstRound": sum(row["round"] == "premier" for row in polls),
                "secondRound": sum(row["round"] == "second" for row in polls),
            }
        if path == "api/qualite-documentaire.json":
            health = json.loads(raw)
            if health["sourceCommit"] != marker["sourceCommit"]:
                raise ValueError("La qualité documentaire référence une autre édition")
            declared_polls = health["polls"]
    if observed_polls is None or declared_polls is None or any(
        declared_polls.get(key) != value for key, value in observed_polls.items()
    ):
        raise ValueError("Les compteurs de sondages diffèrent du jeu de données servi")
    return results


def check_private_stats():
    try:
        with opener.open(Request(SITE + "/stats/", method="HEAD"), timeout=10):
            raise ValueError("Authentification attendue sur les statistiques privées")
    except HTTPError as exc:
        if exc.code != 401 or not exc.headers.get("WWW-Authenticate"):
            raise ValueError("Authentification des statistiques privées non confirmée") from None
    return 401


def main(full=False, revision=None):
    branch = fetch(GITHUB + "/branches/main")["commit"]["sha"]
    marker = fetch(SITE + "/build.json", extra={"Cache-Control": "no-cache"})
    first = marker["sourceCommit"]
    if revision and (first != revision or branch != revision):
        raise ValueError("La révision attendue n’est plus la révision active de main et du site")
    status = fetch(SITE + "/api/v1/corpus")
    init = rpc("initialize", {"protocolVersion": LEGACY, "capabilities": {},
                              "clientInfo": {"name": "polradar-etat-public", "version": "1"}})
    if init["protocolVersion"] != LEGACY:
        raise ValueError("Négociation MCP inattendue")
    server = init["serverInfo"]
    rpc("notifications/initialized", {}, notify=True)
    tools = advertised_tools(LEGACY)
    if verify_call("polradar_corpus", {}, status) != status["donnees"]:
        raise ValueError("Le corpus MCP et le corpus REST diffèrent")
    announced = rpc("server/discover", {}, CURRENT)
    if CURRENT not in announced["supportedVersions"] or advertised_tools(CURRENT) != tools:
        raise ValueError("Découverte MCP actuelle incohérente")
    verify_call("polradar_corpus", {}, status, CURRENT)
    registry_name = "https://registry.modelcontextprotocol.io/v0.1/servers/io.github.bluetouff%2Fpolradar/versions/"
    if not re.fullmatch(r"\d{1,6}\.\d{1,6}\.\d{1,6}", server["version"]):
        raise ValueError("Version de service inattendue")
    listing = fetch(registry_name + server["version"])["server"]
    if (listing["name"] != "io.github.bluetouff/polradar"
            or listing["version"] != server["version"]
            or listing["remotes"] != [{"type": "streamable-http", "url": SITE + "/api/mcp"}]):
        raise ValueError("Fiche du registre différente du service public")
    exports = fetch(SITE + "/api/exports-v1.json")
    probes = extended_probe(status) if full else None
    surfaces = verify_surfaces(marker, status["donnees"])
    private_stats_status = check_private_stats()
    end = fetch(SITE + "/build.json", extra={"Cache-Control": "no-cache"})["sourceCommit"]
    service = status["revisionDuService"]
    if not all(isinstance(value, str) and SHA.fullmatch(value) for value in [branch, first, end, service]):
        raise ValueError("Révision non vérifiable")
    if first != end or first != status["revisionDuSite"] or first != exports["sourceCommit"]:
        raise ValueError("L’édition a changé pendant le contrôle, recommencer")
    c = status["donnees"]
    counts = {k: c[k] for k in ("campagne", "parti", "orientations", "archives", "sources")}
    counts["propositions"] = c["campagne"] + c["parti"]
    counts["fichesTotal"] = sum(c[k] for k in ("campagne", "parti", "orientations", "archives"))
    runs = fetch(GITHUB + "/actions/runs?branch=main&per_page=12")["workflow_runs"]
    return {"observeLe": datetime.now(timezone.utc).isoformat(timespec="seconds"), "depot":branch,
            "site":first, "service":service, "versionService":server["version"], "comptages":counts,
            "exports":[j["id"] for j in exports["jeux"]],
            "outils": tools, "protocoles": [LEGACY, CURRENT], "registreMCP": registry_name + server["version"],
            "testsMCP": probes,
            "surfaces": surfaces, "empreintesValidees": "sha256" in marker,
            "statistiquesPriveesSansIdentifiants": private_stats_status,
            "contrats":c["contratsCollections"],"workflowsRecents":[{"nom":r["name"],"revision":r["head_sha"],
            "conclusion":r["conclusion"],"url":r["html_url"]} for r in runs],
            "sources":[SITE+"/build.json",SITE+"/api/v1/corpus",SITE+"/api/exports-v1.json",SITE+"/api/mcp",GITHUB+"/branches/main"],
            "perimetre":"Les mesures comptent les fiches et les outils effectivement servis au moment du relevé."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mcp-complet", action="store_true", help="Interroge les onze outils et les quinze collections une fois")
    parser.add_argument("--revision", help="Révision de main attendue en production.")
    args = parser.parse_args()
    if args.revision and not SHA.fullmatch(args.revision):
        parser.error("La révision doit être un SHA Git complet.")
    result = main(args.mcp_complet, args.revision)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if result["testsMCP"] and any(
        entry["etat"] != "ok"
        for group in result["testsMCP"].values() for entry in group.values()
    ):
        raise SystemExit(1)
