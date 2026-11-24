"""Exercise ordinary local HTTP requests through the checked Polradar Apache include."""
import http.client
from http.server import BaseHTTPRequestHandler
from socketserver import UnixStreamServer
from threading import Thread
from pathlib import Path
import os
import runpy
import secrets
import shutil
import socket
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]


def main():
    daemon = shutil.which('apache2') or shutil.which('httpd') or '/usr/sbin/httpd'
    modules = next(p for p in map(Path,('/usr/lib/apache2/modules','/usr/libexec/apache2')) if p.is_dir())
    builtins = subprocess.check_output([daemon,'-l'],text=True)
    with tempfile.TemporaryDirectory(prefix='polradar-http-',dir='/tmp') as temp:
        root = Path(temp)
        (root/'index.txt').write_text('contrôle statique')
        unix = root/'backend.sock'
        token = 'recette-'+secrets.token_hex(12)
        with socket.socket() as probe:
            probe.bind(('127.0.0.1',0))
            port = probe.getsockname()[1]
        operations = runpy.run_path(str(ROOT/'deploy/operations/install.py'))
        vhost = operations['patched_vhost']('<VirtualHost *:443>\nServerName polradar.fr\n'
            +'CustomLog "'+str(root/'access.log')+'" combined env=!polradar_stats_request\n</VirtualHost>').replace('*:443','127.0.0.1:'+str(port))
        include = (ROOT/'mcp/deploy/apache.conf').read_text().replace('/run/polradar-mcp.sock',str(unix))
        config_stats = runpy.run_path(str(ROOT/'deploy/goaccess/install.py'))['APACHE']
        stats_lines = [line.replace('/var/log/polradar/access.log',str(root/'goaccess.log'))
                       for line in config_stats.splitlines() if line.startswith(('LogFormat ','CustomLog ','SetEnvIf '))]
        assert len(stats_lines) == 3
        (root/'api.conf').write_text(include+'\n'+'\n'.join(stats_lines)+'\n')
        vhost = vhost.replace('/etc/apache2/polradar-mcp.conf',str(root/'api.conf'))
        names = 'mpm_prefork unixd authz_core authz_host log_config headers setenvif proxy proxy_http'.split()
        lines = [f'ServerRoot "{root}"',f'Listen 127.0.0.1:{port}',f'PidFile "{root}/pid"',f'DefaultRuntimeDir "{root}"','ServerName localhost']
        for name in names:
            if f'mod_{name}.c' not in builtins and (modules/f'mod_{name}.so').is_file():
                lines.append(f'LoadModule {name}_module "{modules}/mod_{name}.so"')
        lines += [f'User #{os.getuid()}',f'Group #{os.getgid()}',f'DocumentRoot "{root}"',
                  'LogFormat "%h %r %{Referer}i" combined',f'ErrorLog "{root}/error.log"',
                  f'<Directory "{root}">','Require all granted','</Directory>',vhost]
        config = root/'httpd.conf'
        config.write_text('\n'.join(lines)+'\n')
        cmd = [daemon,'-X','-f',str(config)]
        subprocess.run([daemon,'-t','-f',str(config)],check=True)
        server = subprocess.Popen(cmd,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        def get(path, referer=None):
            conn = http.client.HTTPConnection('127.0.0.1',port,timeout=3)
            headers={'Host':'polradar.fr'}
            if referer: headers['Referer']=referer
            try:
                conn.request('GET',path,headers=headers)
                res=conn.getresponse()
                res.read()
                return res.status
            finally: conn.close()
        try:
            for _ in range(50):
                if server.poll() is not None: raise RuntimeError('Apache a quitté avant le contrôle local')
                try:
                    if get('/index.txt')==200: break
                except OSError: time.sleep(.08)
            else: raise RuntimeError('Lecture témoin impossible')
            class Backend(BaseHTTPRequestHandler):
                def do_GET(self):
                    self.send_response(200)
                    self.send_header('Content-Length','0')
                    self.end_headers()
                def log_message(self,*args): pass
            with UnixStreamServer(str(unix),Backend) as upstream:
                thread=Thread(target=upstream.serve_forever,daemon=True)
                thread.start()
                try: assert get('/api/v1/mesures?query='+token)==200
                finally: upstream.shutdown();thread.join(timeout=3)
            unix.unlink()
            # Normal proxy failure while the fixture backend is stopped.
            assert get('/api/v1/mesures?query='+token) in (502,503)
            assert get('/index.txt','https://polradar.fr/api/v1/mesures?query='+token)==200
        finally:
            server.terminate()
            server.wait(timeout=5)
        access=(root/'access.log').read_text()
        error=(root/'error.log').read_text()
        assert '/index.txt' in access and 'proxy' in error
        goaccess=(root/'goaccess.log').read_text()
        assert '/index.txt' in goaccess and 'api/v1/' not in access and 'api/v1/' not in goaccess
        assert all(token not in log for log in (access,error,goaccess))
        print('Apache local : accès statique journalisé, paramètres de recherche absents des journaux d’accès, GoAccess et d’erreur.')


if __name__ == '__main__': main()
