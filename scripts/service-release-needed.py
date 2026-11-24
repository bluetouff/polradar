"""Use the last published service on this lineage, including skipped Site runs."""
import json
import re
import subprocess
import sys
from pathlib import Path

INPUTS = ('mcp', 'deploy/operations', 'deploy/goaccess', '.github/workflows/services.yml',
          'scripts/test-mcp-release.py', 'scripts/test-mcp-compatibility.py',
          'scripts/service-release-needed.py', 'scripts/test-apache-privacy.py', 'tests/deploy/test_private_services.py')


def needed(releases, repo='.'):
    commits = {r['tagName'][9:] for r in releases if not r['isDraft'] and not r['isPrerelease']
               and re.fullmatch(r'services-[a-f0-9]{40}', r['tagName'])}
    history = subprocess.check_output(['git','rev-list','--first-parent','HEAD'],cwd=repo,text=True)
    base = next((sha for sha in history.splitlines() if sha in commits), None)
    if base is None:
        return True
    diff = subprocess.run(['git','diff','--quiet',base,'HEAD','--',*INPUTS],cwd=repo)
    if diff.returncode not in (0,1):
        raise RuntimeError('Lecture de la référence précédente impossible')
    return diff.returncode == 1


if __name__ == '__main__':
    print('needed='+str(needed(json.loads(Path(sys.argv[1]).read_text()))).lower())
