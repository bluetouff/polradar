#!/usr/bin/env python3
"""Install the reviewed deployer and preserve the user's existing crontab."""
import os
from pathlib import Path
import shutil
import shlex
import subprocess

if os.geteuid() == 0:
    raise SystemExit('Use the unprivileged site account, never root.')
root = Path.home() / '.local/share/polradar'
root.mkdir(parents=True, exist_ok=True, mode=0o700)
root.chmod(0o700)
script = root / 'pull-release.py'
shutil.copyfile(Path(__file__).with_name('pull-release.py'), script)
script.chmod(0o600)
result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
if result.returncode not in (0, 1):
    raise SystemExit('Cannot read existing crontab.')
marker = '# polradar-public-deploy'
lines = [line for line in result.stdout.splitlines() if marker not in line]
line = f'*/5 * * * * /usr/bin/python3 {shlex.quote(str(script))} >> {shlex.quote(str(root / "deploy.log"))} 2>&1 {marker}'
lines.append(line)
subprocess.run(['crontab', '-'], input='\n'.join(lines) + '\n', text=True, check=True)
print('Installed unprivileged deployer; existing crontab preserved.')
