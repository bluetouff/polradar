#!/usr/bin/env python3
"""Operator-run installation/update. Never invoked by the static-site deployer."""
import argparse
from datetime import datetime, timezone
import grp
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import tempfile

BUNDLE = ('generate.py', 'index.html', 'viewer.mjs', 'viewer.css', 'polradar-stats.service', 'polradar-stats.timer', 'install.py')
VHOST = Path('/etc/apache2/sites-available/polradar-le-ssl.conf')
INCLUDE = Path('/etc/apache2/polradar-stats.conf')
AUTH = Path('/etc/apache2/polradar-stats.htpasswd')
STATE = Path('/var/lib/polradar-stats')
SHARE = Path('/usr/local/share/polradar-stats')
LIB = Path('/usr/local/lib/polradar-stats')
UNITS = Path('/etc/systemd/system')
BACKUPS = Path('/var/backups')
CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
APACHE = '''# Private GoAccess viewer. Root-owned. Included only in Polradar HTTPS.
LogFormat "%h %l %u %t \\"%m %U %H\\" %>s %b \\"%{Referer}i\\" \\"%{User-Agent}i\\"" polradar_stats_combined
SetEnvIf Request_URI "^/stats(?:/|$)" polradar_stats_request
CustomLog /var/log/polradar/access.log polradar_stats_combined env=!polradar_stats_request
Alias /stats/report.json /var/lib/polradar-stats/report.json
Alias /stats/ /usr/local/share/polradar-stats/
<Directory /usr/local/share/polradar-stats>
    Options -Indexes -ExecCGI
    AllowOverride None
    DirectoryIndex index.html
    AddType text/javascript .mjs
    AddType text/css .css
    AddType text/html .html
    Require all denied
</Directory>
<Directory /var/lib/polradar-stats>
    Options -Indexes -ExecCGI
    AllowOverride None
    AddType application/json .json
    Require all denied
</Directory>
<LocationMatch "^/stats(?:/|$)">
    AuthType Basic
    AuthName "Polradar - GoAccess"
    AuthUserFile /etc/apache2/polradar-stats.htpasswd
    Require valid-user
    Header always set Cache-Control "private, no-store, max-age=0"
    Header always set X-Robots-Tag "noindex, nofollow, noarchive"
    Header always set Referrer-Policy "no-referrer"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Content-Security-Policy "CSP_PLACEHOLDER"
</LocationMatch>
RedirectMatch 302 ^/stats$ /stats/
'''.replace('CSP_PLACEHOLDER', CSP)
LOGROTATE = '''/var/log/polradar/access.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root polradarstats
    sharedscripts
    postrotate
        /usr/sbin/apache2ctl graceful > /dev/null
    endscript
}
'''


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=320).stdout


def make_directory(path, mode):
    # The operator's restrictive umask also applies through sudo. Apply the
    # reviewed traversal permissions explicitly after creation.
    path.mkdir(mode=mode)
    path.chmod(mode)


def patched_vhost(text):
    if len(re.findall(r'<VirtualHost\b', text, re.I)) != 1 or len(re.findall(r'</VirtualHost>', text, re.I)) != 1:
        raise ValueError('Expected one HTTPS vhost; manual review required')
    if not re.search(r'^\s*ServerName\s+polradar\.fr\s*$', text, re.M):
        raise ValueError('Unexpected vhost identity')
    if re.search(r'(?im)^\s*(?:CustomLog|Alias|ScriptAlias)\b', text) or 'polradar-stats' in text or re.search(r'<Location', text, re.I):
        raise ValueError('Existing routing or logging requires manual review')
    return re.sub(r'</VirtualHost>', '    Include /etc/apache2/polradar-stats.conf\n</VirtualHost>', text, count=1, flags=re.I)


def verify_bundle(directory):
    manifest = json.loads((directory / 'manifest.json').read_text())
    if not re.fullmatch(r'[a-f0-9]{40}', manifest.get('sourceCommit', '')) or set(manifest.get('files', {})) != set(BUNDLE):
        raise ValueError('Invalid bundle manifest')
    for name in BUNDLE:
        path = directory / name
        if path.is_symlink() or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != manifest['files'][name]:
            raise ValueError('Bundle integrity failure')
    return manifest


def install(directory):
    if os.geteuid() != 0:
        raise ValueError('Run this reviewed installer as the operator with sudo')
    manifest = verify_bundle(directory)
    if not VHOST.is_file() or VHOST.is_symlink() or not AUTH.is_file() or AUTH.is_symlink():
        raise ValueError('Expected Apache vhost and dedicated Polradar authentication file')
    for path in (VHOST, AUTH):
        if path.stat().st_uid != 0 or path.stat().st_mode & 0o022:
            raise ValueError('Apache configuration or authentication permissions require review')
    if any(p.exists() for p in [INCLUDE, STATE, SHARE, LIB, Path('/var/log/polradar'), Path('/etc/logrotate.d/polradar-stats'), Path('/etc/systemd/system/polradar-stats.service'), Path('/etc/systemd/system/polradar-stats.timer')]):
        raise ValueError('Installation already exists; do not overwrite it')
    if not all(Path(p).is_file() for p in ['/usr/sbin/nologin', '/usr/bin/goaccess', '/usr/sbin/logrotate']):
        raise ValueError('Required Debian executable unavailable')
    try:
        pwd.getpwnam('polradarstats')
    except KeyError:
        pass
    else:
        raise ValueError('Existing service identity requires review')
    for group in ['www-data']:
        grp.getgrnam(group)
    if 'GoAccess - 1.12.' not in run(['/usr/bin/goaccess', '--version']):
        raise ValueError('This bundle was validated for GoAccess 1.12')
    modules = run(['/usr/sbin/apache2ctl', '-M'])
    if not all(module in modules for module in ['alias_module', 'auth_basic_module', 'authn_file_module', 'authz_user_module', 'headers_module', 'setenvif_module', 'mime_module', 'dir_module']):
        raise ValueError('Required Apache modules unavailable')
    original = VHOST.read_text()
    replacement = patched_vhost(original)
    backup = Path('/var/backups') / ('polradar-stats-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    make_directory(backup, 0o700)
    (backup / 'vhost.conf').write_text(original)
    (backup / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    rollback = f'''#!/bin/sh
set -eu
systemctl disable --now polradar-stats.timer
cp '{backup}/vhost.conf' '{VHOST}'
/usr/sbin/apache2ctl configtest
systemctl reload apache2
# Report and installed files are kept private for inspection.
'''
    (backup / 'rollback.sh').write_text(rollback)
    (backup / 'rollback.sh').chmod(0o700)
    run(['/usr/sbin/useradd', '--system', '--no-create-home', '--user-group', '--home-dir', '/nonexistent', '--shell', '/usr/sbin/nologin', 'polradarstats'])
    uid = pwd.getpwnam('polradarstats').pw_uid
    www = grp.getgrnam('www-data').gr_gid
    log_group = grp.getgrnam('polradarstats').gr_gid
    for path in [STATE, SHARE, LIB]:
        make_directory(path, 0o750 if path == STATE else 0o755)
    os.chown(STATE, uid, www)
    logdir = Path('/var/log/polradar'); make_directory(logdir, 0o750); os.chown(logdir, 0, log_group)
    logfile = logdir / 'access.log'; logfile.touch(mode=0o640); logfile.chmod(0o640); os.chown(logfile, 0, log_group)
    for name in ['index.html', 'viewer.mjs', 'viewer.css']:
        shutil.copyfile(directory / name, SHARE / name); (SHARE / name).chmod(0o644)
    shutil.copyfile(directory / 'generate.py', LIB / 'generate.py'); (LIB / 'generate.py').chmod(0o644)
    for name in ['polradar-stats.service', 'polradar-stats.timer']:
        destination = Path('/etc/systemd/system') / name
        shutil.copyfile(directory / name, destination); destination.chmod(0o644)
    INCLUDE.write_text(APACHE); INCLUDE.chmod(0o644)
    Path('/etc/logrotate.d/polradar-stats').write_text(LOGROTATE)
    try:
        VHOST.write_text(replacement)
        run(['/usr/sbin/apache2ctl', 'configtest'])
        run(['/bin/systemctl', 'daemon-reload'])
        run(['/bin/systemctl', 'start', 'polradar-stats.service'])
        run(['/bin/systemctl', 'reload', 'apache2'])
        run(['/bin/systemctl', 'enable', '--now', 'polradar-stats.timer'])
    except Exception:
        subprocess.run(['/bin/systemctl', 'disable', '--now', 'polradar-stats.timer'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30, check=False)
        VHOST.write_text(original)
        run(['/usr/sbin/apache2ctl', 'configtest'])
        run(['/bin/systemctl', 'reload', 'apache2'])
        raise ValueError(f'Activation stopped; original vhost restored. Inspect {backup}') from None
    print(json.dumps({'installed': True, 'sourceCommit': manifest['sourceCommit'], 'reportUrl': 'https://polradar.fr/stats/', 'rollback': str(backup / 'rollback.sh'), 'logStartedAt': datetime.now(timezone.utc).isoformat()}))


def checked_file(path, uid=0):
    if path.is_symlink() or not path.is_file() or path.stat().st_uid != uid or path.stat().st_mode & 0o022:
        raise ValueError('Existing private installation requires review')


def checked_directory(path, uid=0):
    if path.is_symlink() or not path.is_dir() or path.stat().st_uid != uid or path.stat().st_mode & 0o022:
        raise ValueError('Unsafe installed directory')


def atomic_copy(source, target, mode=0o644, uid=0, gid=0, expected_digest=None):
    # Target directories are checked before writing; a temporary sibling is
    # replaced atomically. Never open an existing target for truncation.
    fd, name = tempfile.mkstemp(dir=target.parent, prefix='.polradar-update-')
    temporary = Path(name)
    try:
        with os.fdopen(fd, 'wb') as output:
            content = source.read_bytes()
            if expected_digest is not None and hashlib.sha256(content).hexdigest() != expected_digest:
                raise ValueError('Bundle changed after verification')
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, mode)
        os.chown(temporary, uid, gid)
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def update(directory):
    if os.geteuid() != 0:
        raise ValueError('Run this reviewed update as the operator with sudo')
    manifest = verify_bundle(directory)
    uid = pwd.getpwnam('polradarstats').pw_uid
    for path in (VHOST, INCLUDE, AUTH):
        checked_file(path)
    if AUTH.stat().st_mode & 0o007:
        raise ValueError('Authentication file permissions require review')
    for path in (SHARE, LIB):
        checked_directory(path)
    checked_directory(STATE, uid)
    if STATE.stat().st_mode & 0o007:
        raise ValueError('Unexpected private state directory')
    targets = {name: SHARE / name for name in ('index.html', 'viewer.mjs', 'viewer.css')}
    targets['generate.py'] = LIB / 'generate.py'
    for path in targets.values():
        checked_file(path)
    # Units, Apache routing, authentication and log rotation are preserved.
    for name in ('polradar-stats.service', 'polradar-stats.timer'):
        installed = UNITS / name
        checked_file(installed)
        if installed.read_bytes() != (directory / name).read_bytes():
            raise ValueError('Modified service unit requires manual review')
    if 'GoAccess - 1.12.' not in run(['/usr/bin/goaccess', '--version']):
        raise ValueError('This update was validated for GoAccess 1.12')
    run(['/usr/sbin/apache2ctl', 'configtest'])
    timer = run(['/bin/systemctl', 'show', 'polradar-stats.timer', '-p', 'ActiveState', '--value']).strip()
    if timer not in ('active', 'inactive'):
        raise ValueError('Timer state requires review')
    backup = Path(tempfile.mkdtemp(dir=BACKUPS, prefix='polradar-stats-update-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-'))
    backup.chmod(0o700)
    (backup / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    saved = False
    resume_timer = True
    run(['/bin/systemctl', 'stop', 'polradar-stats.timer'])
    try:
        # Let an existing generation finish (or run the old collector once)
        # before snapshotting its report. No concurrent timer starts can occur.
        run(['/bin/systemctl', 'start', 'polradar-stats.service'])
        report = STATE / 'report.json'
        checked_file(report, uid)
        previous_stat = report.stat()
        if previous_stat.st_mode & 0o007:
            raise ValueError('Report permissions require review')
        for name, path in targets.items():
            shutil.copyfile(path, backup / name)
            (backup / name).chmod(0o600)
        shutil.copyfile(report, backup / 'report.json')
        (backup / 'report.json').chmod(0o600)
        saved = True
        for name, path in targets.items():
            atomic_copy(directory / name, path, expected_digest=manifest['files'][name])
        run(['/bin/systemctl', 'start', 'polradar-stats.service'])
        checked_file(report, uid)
        if report.stat().st_size > 20 * 1024 * 1024:
            raise ValueError('Updated report exceeds its bound')
        result = json.loads(report.read_text())
        if result.get('schemaVersion') != 1 or result.get('status') not in ('ready', 'waiting'):
            raise ValueError('Updated report format invalid')
    except BaseException:
        if saved:
            try:
                run(['/bin/systemctl', 'stop', 'polradar-stats.service'])
                pending = STATE / 'report.tmp'
                if pending.exists() or pending.is_symlink():
                    checked_file(pending, uid)
                    if pending.stat().st_size > 20 * 1024 * 1024:
                        raise ValueError('Temporary report exceeds its bound')
                    shutil.copyfile(pending, backup / 'failed-report.tmp')
                    (backup / 'failed-report.tmp').chmod(0o600)
                    pending.unlink()
                for name, path in targets.items():
                    atomic_copy(backup / name, path)
                atomic_copy(backup / 'report.json', STATE / 'report.json', previous_stat.st_mode & 0o777, previous_stat.st_uid, previous_stat.st_gid)
                run(['/bin/systemctl', 'start', 'polradar-stats.service'])
            except BaseException:
                resume_timer = False
                raise ValueError(f'Update stopped; rollback requires review; timer remains stopped. Backup: {backup}') from None
        raise ValueError(f'Update stopped; previous files retained/restored. Backup: {backup}') from None
    finally:
        if timer == 'active' and resume_timer:
            run(['/bin/systemctl', 'start', 'polradar-stats.timer'])
    print(json.dumps({'updated': True, 'sourceCommit': manifest['sourceCommit'], 'reportUrl': 'https://polradar.fr/stats/', 'backup': str(backup)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Install or update the private Polradar GoAccess viewer')
    parser.add_argument('--update', action='store_true', help='Update reviewed viewer/collector files only; preserve authentication, logs and units')
    args = parser.parse_args()
    try:
        (update if args.update else install)(Path(__file__).resolve().parent)
    except Exception as error:
        raise SystemExit(f'Installation stopped: {error}') from None
