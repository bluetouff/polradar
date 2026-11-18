#!/usr/bin/env python3
"""Operator-run, first installation only. Never invoked by the static-site deployer."""
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

BUNDLE = ('generate.py', 'index.html', 'viewer.mjs', 'viewer.css', 'polradar-stats.service', 'polradar-stats.timer', 'install.py')
VHOST = Path('/etc/apache2/sites-available/polradar-le-ssl.conf')
INCLUDE = Path('/etc/apache2/polradar-stats.conf')
AUTH = Path('/etc/apache2/polradar-stats.htpasswd')
STATE = Path('/var/lib/polradar-stats')
SHARE = Path('/usr/local/share/polradar-stats')
LIB = Path('/usr/local/lib/polradar-stats')
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


if __name__ == '__main__':
    try:
        install(Path(__file__).resolve().parent)
    except Exception as error:
        raise SystemExit(f'Installation stopped: {error}') from None
