"""Activate a reviewed Polradar service on Debian. Run only on the serving machine."""
import argparse
import fcntl
import grp
import hashlib
import json
import os
from pathlib import Path
import platform
import pwd
import re
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

APACHE = Path('/etc/apache2')
VHOST = APACHE/'sites-available/polradar-le-ssl.conf'
STATS = APACHE/'polradar-stats.conf'
AUTH = APACHE/'polradar-stats.htpasswd'
UNITS = Path('/etc/systemd/system')
VIEW = Path('/usr/local/share/polradar-stats')
MCP = ('apache.conf','polradar-mcp.service','polradar-mcp.socket','polradar-mcp')
GSC = ('gsc_collect.py','gsc_view.py','polradar-gsc.service','polradar-gsc.timer','index.html','viewer.css','viewer.mjs')
CREDENTIAL = Path('/etc/polradar-gsc/reader.json')
READER = 'polradar-gsc-reader@polradar.iam.gserviceaccount.com'
ALIAS = 'AliasMatch "^/stats/google[.]html$" /var/lib/polradar-gsc-report/report.html'
MCP_INCLUDE = 'Include /etc/apache2/polradar-mcp.conf'
SAFE_ENV = {'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C','LC_ALL':'C'}


def cmd(args, check=True, timeout=170, stdin=None):
    return subprocess.run(args, input=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=SAFE_ENV,
                          timeout=timeout,check=check)


def safe_file(path):
    st = path.lstat()
    if not stat.S_ISREG(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022:
        raise ValueError(f'Fichier système inattendu : {path}')
    return st


def safe_dir(path):
    st = path.lstat()
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022:
        raise ValueError(f'Dossier système inattendu : {path}')


def root_dir(path):
    safe_dir(path.parent)
    if not path.exists():
        path.mkdir(mode=0o755)
        path.chmod(0o755)
    safe_dir(path)


def write(path, data, mode=0o644, uid=0, gid=0):
    fd, tmp = tempfile.mkstemp(prefix='.polradar-',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as f:
            f.write(data)
            os.fchown(f.fileno(),uid,gid)
            os.fchmod(f.fileno(),mode)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp,path)
    finally:
        Path(tmp).unlink(missing_ok=True)


def bundle(directory, kind):
    manifest = json.loads((directory/'manifest.json').read_bytes())
    names = set((MCP if kind=='mcp' else GSC) + ('LICENSE','install.py'))
    if (manifest.get('component') != kind or not re.fullmatch('[a-f0-9]{40}',manifest.get('sourceCommit','')) or
            set(manifest.get('files',{})) != names):
        raise ValueError('Manifeste inattendu')
    if kind=='mcp' and manifest.get('arch') != {'aarch64':'arm64','x86_64':'amd64'}.get(platform.machine(),'unsupported'):
        raise ValueError('Architecture incompatible')
    contents = {}
    for name in names:
        p = directory/name
        st = p.lstat()
        if not stat.S_ISREG(st.st_mode) or not 0 < st.st_size <= 32*1024*1024:
            raise ValueError('Entrée du paquet invalide')
        data = p.read_bytes()
        if hashlib.sha256(data).hexdigest()!=manifest['files'][name]:
            raise ValueError('Empreinte invalide')
        contents[name]=data
    return manifest,contents


def patched_vhost(text):
    if len(re.findall(r'(?i)<VirtualHost\s+[^>]*:443\s*>',text))!=1 or len(re.findall(r'(?i)<VirtualHost\b',text))!=1 or len(re.findall(r'(?i)</VirtualHost>',text))!=1 or not re.search(r'(?m)^\s*ServerName\s+polradar\.fr\s*$',text):
        raise ValueError('Vhost HTTPS Polradar attendu')
    if MCP_INCLUDE in text:
        if text.count(MCP_INCLUDE)!=1 or not re.search(r'(?m)^\s*'+re.escape(MCP_INCLUDE)+r'\s*$',text):
            raise ValueError('Include MCP ambigu')
        return text
    return re.sub('(?i)</VirtualHost>','    '+MCP_INCLUDE+'\n</VirtualHost>',text,count=1)


def private_alias(text):
    opener = '<LocationMatch "^/stats(?:/|$)">'
    match = re.search(re.escape(opener)+r'([\s\S]*?)</LocationMatch>', text)
    required = ['AuthType Basic','AuthUserFile /etc/apache2/polradar-stats.htpasswd','Require valid-user']
    if not match or any(x not in [s.strip() for s in match[1].splitlines()] for x in required):
        raise ValueError('Protection existante de /stats/ non reconnue')
    anchor = 'Alias /stats/report.json /var/lib/polradar-stats/report.json'
    if text.count(anchor)!=1 or text.count('Alias /stats/ /usr/local/share/polradar-stats/')!=1:
        raise ValueError('Alias GoAccess inattendus')
    if ALIAS in text:
        if text.count(ALIAS)!=1 or text.index(ALIAS)>text.index(anchor):
            raise ValueError('Alias Google ambigu')
        return text
    if 'polradar-gsc-report' in text or '/stats/google' in text:
        raise ValueError('Route Google déjà occupée')
    return text.replace(anchor,ALIAS+'\n<Directory /var/lib/polradar-gsc-report>\n    Options None\n    AllowOverride None\n    Require all denied\n</Directory>\n'+anchor)


def systemctl(*args,check=True):
    return cmd(['/bin/systemctl',*args],check=check)


def is_active(unit):
    return systemctl('is-active','--quiet',unit,check=False).returncode==0


def smoke(path, payload=None):
    args=['/usr/bin/curl','--silent','--show-error','--noproxy','*','--resolve','polradar.fr:443:127.0.0.1','--max-time','15','--proto','=https','--write-out','\n%{http_code}']
    if payload is not None:
        args += ['--header','Content-Type: application/json','--header','Accept: application/json, text/event-stream','--data-binary','@-']
    raw=cmd([*args,'https://polradar.fr'+path],stdin=json.dumps(payload).encode() if payload is not None else None).stdout
    body,code=raw.rsplit(b'\n',1)
    return int(code),body


def require_private(path):
    if smoke(path)[0]!=401:
        raise ValueError('Authentification obligatoire non confirmée sur '+path)


def enrollment_data(data, key_id):
    if len(data) > 32768 or not re.fullmatch(r'[a-f0-9]{40}', key_id):
        raise ValueError('Certificat public ou fichier de compte invalide')
    try:
        info = json.loads(data)
    except (ValueError, UnicodeError):
        raise ValueError('Fichier de compte illisible') from None
    if (not isinstance(info, dict) or info.get('type') != 'service_account'
            or info.get('project_id') != 'polradar' or info.get('client_email') != READER
            or info.get('token_uri') != 'https://oauth2.googleapis.com/token'
            or info.get('private_key_id', key_id) != key_id
            or not isinstance(info.get('private_key'), str)
            or not info['private_key'].startswith('-----BEGIN PRIVATE KEY-----\n')
            or not info['private_key'].rstrip().endswith('-----END PRIVATE KEY-----')):
        raise ValueError('Compte de service ou certificat inattendu')
    fields = ('type', 'project_id', 'client_email', 'token_uri', 'private_key')
    return {**{name: info[name] for name in fields}, 'private_key_id': key_id}


def enroll_google(data, key_id):
    account = enrollment_data(data, key_id)
    safe_dir(CREDENTIAL.parent.parent)
    if not CREDENTIAL.parent.exists():
        CREDENTIAL.parent.mkdir(mode=0o700)
    safe_dir(CREDENTIAL.parent)
    if CREDENTIAL.parent.stat().st_mode & 0o077:
        raise ValueError('Le dossier du compte doit être en 0700')
    if CREDENTIAL.exists() or CREDENTIAL.is_symlink():
        st = safe_file(CREDENTIAL)
        if st.st_mode & 0o777 != 0o600 or enrollment_data(CREDENTIAL.read_bytes(), key_id) != account:
            raise ValueError('Un autre compte est déjà installé')
    write(CREDENTIAL, json.dumps(account).encode(), 0o600)


def provision_google():
    cred=CREDENTIAL
    safe_dir(cred.parent)
    if (safe_file(cred).st_mode & 0o777)!=0o600 or (cred.parent.stat().st_mode & 0o077):
        raise ValueError('Clé attendue : root, 0600, dans un dossier root 0700')
    cmd(['/usr/bin/python3','-I','-c','from google.auth import crypt,jwt'])
    try:
        account=pwd.getpwnam('polradargsc')
    except KeyError:
        cmd(['/usr/sbin/useradd','--system','--user-group','--no-create-home','--home-dir','/nonexistent','--shell','/usr/sbin/nologin','polradargsc'])
        account=pwd.getpwnam('polradargsc')
    if account.pw_uid==0 or account.pw_gid!=grp.getgrnam('polradargsc').gr_gid or account.pw_shell!='/usr/sbin/nologin' or len(os.getgrouplist(account.pw_name,account.pw_gid))!=1:
        raise ValueError('Identité de service Google inattendue')
    target=Path('/var/lib/polradar-gsc-report')
    group=grp.getgrnam('www-data').gr_gid
    safe_dir(target.parent)
    if not target.exists():
        target.mkdir(mode=0o700)
        os.chown(target,account.pw_uid,group)
        target.chmod(0o2750)
    st=target.lstat()
    if not stat.S_ISDIR(st.st_mode) or (st.st_uid,st.st_gid,st.st_mode & 0o7777)!=(account.pw_uid,group,0o2750):
        raise ValueError('Répertoire de rapport privé inattendu')


def activate(directory, kind, key_id=None):
    if os.geteuid()!=0:
        raise ValueError('Exécuter sur le serveur avec sudo')
    os.umask(0o077)
    manifest,files=bundle(directory,kind)
    for d in (UNITS,Path('/var/backups'),APACHE): safe_dir(d)
    safe_file(VHOST)
    cmd(['/usr/sbin/apache2ctl','configtest'])
    lib=Path('/usr/local/lib/polradar-'+kind)
    root_dir(lib)
    marker=lib/'installed.json'
    previous={}
    if marker.exists():
        safe_file(marker)
        previous=json.loads(marker.read_bytes()).get('managed',{})
    modules=cmd(['/usr/sbin/apache2ctl','-M']).stdout.decode()
    if kind=='mcp':
        needed=('proxy_module','proxy_http_module','headers_module','setenvif_module')
        active='polradar-mcp.socket'
        worker='polradar-mcp.service'
        changes={lib/'polradar-mcp':(files['polradar-mcp'],0o755),APACHE/'polradar-mcp.conf':(files['apache.conf'],0o644),
                 VHOST:(patched_vhost(VHOST.read_text()).encode(),safe_file(VHOST).st_mode&0o777)}
        unit_names=(worker,active)
        shared={VHOST}
    else:
        needed=('alias_module','auth_basic_module','authn_file_module','authz_user_module','headers_module')
        active='polradar-gsc.timer'
        worker='polradar-gsc.service'
        safe_file(STATS)
        if safe_file(AUTH).st_mode&0o007: raise ValueError('Permissions du fichier Apache')
        safe_dir(VIEW)
        require_private('/stats/')
        require_private('/stats/google.html')
        if key_id:
            enroll_google(sys.stdin.buffer.read(32769), key_id)
        provision_google()
        changes={STATS:(private_alias(STATS.read_text()).encode(),0o644)}
        for n in ('gsc_collect.py','gsc_view.py'): changes[lib/n]=(files[n],0o644)
        for n in ('index.html','viewer.css','viewer.mjs'):
            safe_file(VIEW/n)
            changes[VIEW/n]=(files[n],0o644)
        unit_names=(worker,active)
        shared={STATS,VIEW/'index.html',VIEW/'viewer.css',VIEW/'viewer.mjs'}
    if any(n not in modules for n in needed): raise ValueError('Modules Apache requis : '+', '.join(needed))
    for name in unit_names: changes[UNITS/name]=(files[name],0o644)
    managed={str(p):hashlib.sha256(v[0]).hexdigest() for p,v in changes.items() if p not in shared}
    changes[marker]=(json.dumps({'sourceCommit':manifest['sourceCommit'],'managed':managed}).encode(),0o644)
    snapshots={}
    backup=Path(tempfile.mkdtemp(prefix='polradar-'+kind+'-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-',dir='/var/backups'))
    for idx,p in enumerate(changes):
        safe_dir(p.parent)
        if p.is_symlink(): raise ValueError('Lien symbolique inattendu : '+str(p))
        if p.exists():
            st=safe_file(p)
            current=p.read_bytes()
            if p!=marker and p not in shared and previous.get(str(p))!=hashlib.sha256(current).hexdigest():
                raise ValueError('Fichier déjà présent ou modifié : '+str(p))
            snapshots[p]=(current,st.st_mode&0o777,st.st_uid,st.st_gid)
            (backup/str(idx)).write_bytes(current)
        else:
            snapshots[p]=None
    (backup/'paths.json').write_text(json.dumps([str(p) for p in changes],indent=2))
    was_active=is_active(active)
    was_enabled=systemctl('is-enabled','--quiet',active,check=False).returncode==0
    was_worker=is_active(worker)
    try:
        if was_active: systemctl('stop',active)
        if was_worker: systemctl('stop',worker)
        for p,(data,mode) in changes.items():
            if snapshots[p] and p in shared: write(p,data,mode,snapshots[p][2],snapshots[p][3])
            else: write(p,data,mode)
        cmd(['/usr/sbin/apache2ctl','configtest'])
        systemctl('daemon-reload')
        systemctl('enable','--now',active)
        if kind=='gsc': systemctl('start',worker)
        systemctl('reload','apache2')
        if kind=='gsc':
            require_private('/stats/')
            require_private('/stats/google.html')
            report=Path('/var/lib/polradar-gsc-report/report.html')
            st = report.lstat()
            if (not stat.S_ISREG(st.st_mode) or st.st_size < 500 or st.st_mode & 0o777 != 0o640
                    or st.st_uid != pwd.getpwnam('polradargsc').pw_uid or st.st_gid != grp.getgrnam('www-data').gr_gid):
                raise ValueError('Génération ou permissions du rapport privé invalides')
            cmd(['/usr/sbin/runuser','-u','www-data','--','/usr/bin/test','-r',str(report)])
        else:
            if smoke('/api/mcp')[0]!=405: raise ValueError('Route MCP non activée')
            code,body=smoke('/api/mcp',{'jsonrpc':'2.0','id':1,'method':'tools/list','params':{}})
            if code!=200 or len(json.loads(body)['result']['tools'])!=5: raise ValueError('Catalogue MCP invalide')
            code,body=smoke('/api/mcp',{'jsonrpc':'2.0','id':2,'method':'tools/call','params':{'name':'polradar_corpus','arguments':{}}})
            if code!=200 or not json.loads(body).get('result',{}).get('content') or json.loads(body)['result'].get('isError'): raise ValueError('Corpus non lisible par MCP')
            code,body=smoke('/api/mcp-stats.json')
            if code!=200 or json.loads(body).get('status')!='available': raise ValueError('Compteurs MCP indisponibles')
            if STATS.exists(): require_private('/stats/')
    except BaseException as exc:
        systemctl('stop',active,check=False)
        systemctl('stop',worker,check=False)
        if not was_enabled: systemctl('disable',active,check=False)
        for p,old in snapshots.items():
            if old is None: p.unlink(missing_ok=True)
            else: write(p,*old)
        systemctl('daemon-reload')
        cmd(['/usr/sbin/apache2ctl','configtest'])
        systemctl('reload','apache2')
        if was_active: systemctl('start',active)
        if was_worker: systemctl('start',worker)
        # Command errors carry only fixed executable arguments, never third-party output.
        reason = ('commande '+str(exc.cmd[:3])) if isinstance(exc,subprocess.CalledProcessError) else type(exc).__name__
        raise ValueError(f'Activation interrompue ({reason}). Configuration restaurée. Sauvegarde : {backup}') from None
    target='https://polradar.fr/'+('api/mcp' if kind=='mcp' else 'stats/google.html')
    print(json.dumps({'sourceCommit':manifest['sourceCommit'],'url':target,'backup':str(backup)},ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('component',choices=('mcp','gsc'))
    parser.add_argument('--enroll', metavar='ID_DU_CERTIFICAT', help='Importer depuis l’entrée standard le compte dédié déjà préparé sur ce serveur')
    args=parser.parse_args()
    if args.enroll is not None and (args.component != 'gsc' or not re.fullmatch(r'[a-f0-9]{40}', args.enroll)):
        parser.error('--enroll exige le composant gsc et l’identifiant public Google de 40 caractères hexadécimaux')
    if os.geteuid()!=0: raise SystemExit('Exécuter sur le serveur avec sudo')
    # Both installers may touch Apache. Serialize privileged activations.
    with open('/run/polradar-operations.lock','a+b') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        try: activate(Path(__file__).resolve().parent,args.component,args.enroll)
        except Exception as exc: raise SystemExit(str(exc)) from None
