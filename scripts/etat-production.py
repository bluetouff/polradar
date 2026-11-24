"""Measure only the documented public interfaces. Print a dated JSON receipt."""
import json
import re
from datetime import datetime, timezone
from urllib.request import Request, urlopen

SITE = "https://polradar.fr"
GITHUB = "https://api.github.com/repos/bluetouff/polradar"
SHA = re.compile(r"[a-f0-9]{40}")
LIMIT = 3 * 1024 * 1024


def fetch(address, envelope=None):
    headers = {"User-Agent": "Polradar-etat-public/1"}
    data = None
    if envelope is not None:
        headers.update({"Content-Type": "application/json", "Accept": "application/json, text/event-stream",
                        "MCP-Protocol-Version": "2025-11-25"})
        data = json.dumps(envelope).encode()
    with urlopen(Request(address, data=data, headers=headers), timeout=20) as response:
        raw = response.read(LIMIT + 1)
        if len(raw) > LIMIT or response.geturl() != address:
            raise ValueError("Réponse hors limites ou redirigée")
    return json.loads(raw)


def rpc(method, params):
    reply = fetch(SITE + "/api/mcp", {"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    return reply["result"]


def main():
    branch = fetch(GITHUB + "/branches/main")["commit"]["sha"]
    first = fetch(SITE + "/build.json")["sourceCommit"]
    status = fetch(SITE + "/api/v1/corpus")
    tools = rpc("tools/list", {})["tools"]
    server = rpc("initialize", {"protocolVersion": "2025-11-25", "capabilities": {},
                                "clientInfo": {"name": "polradar-etat-public", "version": "1"}})["serverInfo"]
    exports = fetch(SITE + "/api/exports-v1.json")
    end = fetch(SITE + "/build.json")["sourceCommit"]
    service = status["revisionDuService"]
    if not all(SHA.fullmatch(value) for value in [branch, first, end, service]):
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
            "outils": [{"nom":t["name"],"lectureSeule":t.get("annotations",{}).get("readOnlyHint")} for t in tools],
            "contrats":c["contratsCollections"],"workflowsRecents":[{"nom":r["name"],"revision":r["head_sha"],
            "conclusion":r["conclusion"],"url":r["html_url"]} for r in runs],
            "sources":[SITE+"/build.json",SITE+"/api/v1/corpus",SITE+"/api/exports-v1.json",SITE+"/api/mcp",GITHUB+"/branches/main"],
            "perimetre":"Les mesures comptent les fiches et les outils effectivement servis au moment du relevé."}


if __name__ == "__main__":
    print(json.dumps(main(), ensure_ascii=False, indent=2))

