"""Distribute only the documented public datasets, pinned to an immutable site release."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile

DATA = ("corpus", "dossiers", "relations-documentaires", "territoires", "economie", "budgets-programmes", "agenda",
        "marches-predictifs", "documents", "notices-sondages", "qualite-documentaire", "scenarios-sondages",
        "parlement/assemblee", "parlement/recherche",
        "parlement/archives/senat", "parlement/archives/parlement-europeen", "parlement/textes-senat",
        "documentation/breves", "documentation/droit", "documentation/verifications",
        "documentation/financements", "documentation/arcom", "documentation/graphiques")
EXTRA = ("exports-v1", "exports-v1.schema", "openapi", "licences", "catalogue-dcat")
ROOT = Path(__file__).resolve().parents[1]


def create(root, destination, revision):
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("Révision de livraison invalide")
    marker = json.loads((root / "build.json").read_bytes())
    if marker["sourceCommit"] != revision:
        raise ValueError("Le corpus et la révision de livraison diffèrent")
    files = {}
    for stem in (*DATA, *EXTRA):
        name = "api/" + stem + ".json"
        path = root / name
        if not path.is_file() or any(parent.is_symlink() for parent in (path, *path.parents) if parent.is_relative_to(root)):
            raise ValueError("Export public manquant")
        files[name] = path.read_bytes()
        json.loads(files[name])
    catalog = json.loads(files["api/exports-v1.json"])
    advertised = [entry["url"] for entry in catalog["jeux"]]
    if (catalog["version"] != 1 or catalog["sourceCommit"] != revision or sorted(advertised) != sorted(
            "https://polradar.fr/api/" + key + ".json" for key in DATA)):
        raise ValueError("Le catalogue et les fichiers livrés diffèrent")
    if catalog["licence"].get("originaux") != "ODbL-1.0":
        raise ValueError("Licence de la base incohérente")
    files["LICENSE"] = (ROOT / "public/licenses/ODbL-1.0.txt").read_bytes()
    files["CC-BY-4.0.txt"] = (ROOT / "public/licenses/CC-BY-4.0.txt").read_bytes()
    files["REUTILISATION.txt"] = (ROOT / "public/licenses/REUTILISATION.txt").read_bytes()
    manifest = {"version": 1, "sourceCommit": revision, "edition": catalog["edition"],
                "licence": catalog["licence"], "sha256": {
                    name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}}
    files["manifest.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    destination.mkdir(exist_ok=True, parents=True)
    target = destination / "corpus-v1.tar.gz"
    with tempfile.NamedTemporaryFile(dir=destination) as temporary:
        with gzip.GzipFile(filename="", fileobj=temporary, mode="wb", mtime=0) as zipped:
            with tarfile.open(fileobj=zipped, mode="w", format=tarfile.USTAR_FORMAT) as archive:
                for name, data in sorted(files.items()):
                    entry = tarfile.TarInfo(name)
                    entry.mode, entry.size = 0o644, len(data)
                    archive.addfile(entry, io.BytesIO(data))
        temporary.flush()
        # Verify contents before exposing the archive and checksum.
        with tarfile.open(temporary.name) as verified:
            if verified.getnames() != sorted(files) or any(
                    verified.extractfile(name).read() != data for name, data in files.items()):
                raise ValueError("L'archive ne correspond pas aux exports")
        temporary.seek(0)
        payload = temporary.read()
    target.write_bytes(payload)
    digest = hashlib.sha256(payload).hexdigest()
    target.with_name("corpus-v1.sha256").write_text(f"{digest}  {target.name}\n", encoding="ascii")
    return digest


if __name__ == "__main__":
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    print(create(ROOT / "dist", ROOT / "artifacts", sha))
