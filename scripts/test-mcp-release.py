"""Run the MCP contract against the checked site archive for this Git revision."""
import argparse
import os
from pathlib import Path
import runpy
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    deploy = runpy.run_path(str(ROOT / "deploy" / "pull-release.py"))
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if args.archive.stat().st_size > deploy["MAX_ARCHIVE"]:
        raise ValueError("Archive trop volumineuse")
    with tempfile.TemporaryDirectory(prefix="polradar-contrat-") as directory:
        deploy["extract_static"](args.archive.read_bytes(), Path(directory), sha)
        env = dict(os.environ, POLRADAR_TEST_SITE=directory, POLRADAR_TEST_COMMIT=sha)
        subprocess.run(["go", "test", "-race", "-count=1", "-v", "-run", "^TestPublished", "."],
                       cwd=ROOT / "mcp", env=env, check=True)


if __name__ == "__main__":
    main()
