import json
from pathlib import Path
import runpy
import tarfile
import tempfile
import unittest

package = runpy.run_path(str(Path(__file__).resolve().parents[2] / "scripts/package-corpus.py"))


class CorpusDistribution(unittest.TestCase):
    def test_only_published_datasets_at_expected_revision(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            api = root / "api"
            api.mkdir()
            sha = "a" * 40
            (root / "build.json").write_text(json.dumps({"sourceCommit": sha}))
            for stem in (*package["DATA"], *package["EXTRA"]):
                (api / (stem + ".json")).write_text("{}")
            (api / "hors-catalogue.json").write_text("{}")
            (api / "exports-v1.json").write_text(json.dumps({
                "version": 1, "sourceCommit": sha, "edition": "2026-11-24", "licence": {"originaux": "ODbL-1.0"},
                "jeux": [{"url":"https://polradar.fr/api/"+s+".json"} for s in package["DATA"]]}))
            out = root / "archives"
            digest = package["create"](root, out, sha)
            self.assertEqual(digest, package["create"](root, out, sha))
            with tarfile.open(out / "corpus-v1.tar.gz") as archive:
                self.assertNotIn("api/hors-catalogue.json", archive.getnames())
                self.assertEqual(archive.extractfile("LICENSE").read(), (package["ROOT"] / "public/licenses/ODbL-1.0.txt").read_bytes())
                self.assertIn(b"Polradar", archive.extractfile("REUTILISATION.txt").read())
                self.assertIn(b"Attribution 4.0 International", archive.extractfile("CC-BY-4.0.txt").read())
                self.assertEqual(json.load(archive.extractfile("manifest.json"))["sourceCommit"], sha)
            with self.assertRaises(ValueError):
                package["create"](root, out, "b"*40)
            (api / "corpus.json").unlink()
            (api / "corpus.json").symlink_to(api / "hors-catalogue.json")
            with self.assertRaises(ValueError):
                package["create"](root, out, sha)
