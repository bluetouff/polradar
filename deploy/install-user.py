#!/usr/bin/env python3
"""Install the reviewed deployer and preserve the user's existing crontab."""
import argparse
import os
from pathlib import Path
import shutil
import shlex
import subprocess
import tempfile

if os.geteuid() == 0:
    raise SystemExit('Use the unprivileged site account, never root.')
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--update-only', action='store_true',
                    help='Replace the installed deployer without modifying cron.')
args = parser.parse_args()
root = Path.home() / ".local/share/polradar"
root.mkdir(parents=True, exist_ok=True, mode=0o700)
root.chmod(0o700)
script = root / 'pull-release.py'
if args.update_only and (script.is_symlink() or not script.is_file()):
    raise SystemExit('No installed deployer to update.')
# mkstemp and the target live in the same private directory. Cron always opens
# a complete version, even when an update coincides with a scheduled run.
fd, staging_name = tempfile.mkstemp(prefix='.pull-release-', dir=root)
staging = Path(staging_name)
try:
    with os.fdopen(fd, 'wb') as output, Path(__file__).with_name('pull-release.py').open('rb') as src:
        shutil.copyfileobj(src, output)
        output.flush()
        os.fsync(output.fileno())
    os.replace(staging, script)
finally:
    staging.unlink(missing_ok=True)
if args.update_only:
    print('Installed deployer updated. Existing crontab preserved.')
    raise SystemExit(0)
result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
if result.returncode not in (0, 1):
    raise SystemExit('Cannot read existing crontab.')
marker = '# polradar-public-deploy'
lines = [line for line in result.stdout.splitlines() if marker not in line]
line = f'*/5 * * * * /usr/bin/python3 {shlex.quote(str(script))} >> {shlex.quote(str(root / "deploy.log"))} 2>&1 {marker}'
lines.append(line)
subprocess.run(['crontab', '-'], input='\n'.join(lines) + '\n', text=True, check=True)
print('Installed unprivileged deployer; existing crontab preserved.')
