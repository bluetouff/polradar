"""Exercise the installed-file transaction with a simulated Debian service manager."""
from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

ops=runpy.run_path(str(Path(__file__).resolve().parents[2]/'deploy/operations/install.py'))['activate']


class SocketHandoverTest(unittest.TestCase):
    def test_failed_worker_restores_bytes_while_socket_remains_enabled(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            lib,back,apache,units=(root/name for name in ('lib','backup','apache','units'))
            for folder in (lib,back,apache,units): folder.mkdir()
            vhost=apache/'vhost'
            vhost.write_text('<VirtualHost *:443>\nServerName polradar.fr\n</VirtualHost>')
            names=['apache.conf','polradar-mcp.service','polradar-mcp.socket','polradar-mcp']
            paths=[apache/'polradar-mcp.conf',units/names[1],units/names[2],lib/names[3]]
            files={name:name.encode() for name in names}
            old={}
            for name,path in zip(names,paths):
                old[path]=files[name] if name.endswith('.socket') else b'previous-'+files[name]
                path.write_bytes(old[path])
            marker=lib/'installed.json'
            marker.write_text(json.dumps({'sourceCommit':'a'*40,'managed':{str(p):hashlib.sha256(v).hexdigest() for p,v in old.items()}}))
            snapshot={p:p.read_bytes() for p in [*paths,vhost,marker]}
            system=[]
            def route(path):
                return {'/usr/local/lib/polradar-mcp':lib,'/var/backups':back}.get(str(path),Path(path))
            def control(*args,**kwargs):
                system.append(args)
                return SimpleNamespace(returncode=0)
            def write(path,data,mode,*unused):
                temp=path.with_suffix('.temporary')
                temp.write_bytes(data);os.replace(temp,path)
            def smoke(*args):
                self.assertTrue((units/'polradar-mcp.socket').is_file())
                self.assertEqual((lib/'polradar-mcp').read_bytes(),files['polradar-mcp'])
                return 503,b''
            stubs=dict(Path=route,UNITS=units,APACHE=apache,VHOST=vhost,STATS=apache/'no-stats',safe_dir=lambda p:None,
                       root_dir=lambda p:None,safe_file=lambda p:p.stat(),write=write,bundle=lambda *_:({'sourceCommit':'b'*40},files),
                       cmd=lambda *_:SimpleNamespace(stdout=b'proxy_module proxy_http_module headers_module setenvif_module'),
                       systemctl=control,is_active=lambda *_:True,smoke=smoke,
                       tempfile=SimpleNamespace(mkdtemp=lambda **kw:tempfile.mkdtemp(dir=back)))
            with ExitStack() as stack:
                stack.enter_context(patch.dict(ops.__globals__,stubs))
                stack.enter_context(patch.object(os,'geteuid',return_value=0))
                stack.enter_context(patch.object(os,'umask',return_value=0o077))
                with self.assertRaisesRegex(ValueError,'restaurée'): ops(root,'mcp')
            self.assertEqual([args for args in system if args[0] in ('stop','disable')],[])
            self.assertEqual(system.count(('restart','polradar-mcp.service')),2)
            for path,data in snapshot.items(): self.assertEqual(path.read_bytes(),data)

