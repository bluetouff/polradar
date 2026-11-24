"""Check a real Codex CLI MCP session without starting a model turn."""
import argparse
import json
import os
import selectors
import subprocess
import tempfile
import time
from urllib.parse import urlsplit

PUBLIC = 'https://polradar.fr/api/mcp'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default=PUBLIC, help='endpoint public ou /api/mcp sur 127.0.0.1')
    args = parser.parse_args()
    url = urlsplit(args.url)
    if args.url != PUBLIC and not (
        url.scheme == 'http' and url.hostname == '127.0.0.1' and url.port and url.path == '/api/mcp'
        and not (url.username or url.password or url.query or url.fragment)
    ):
        raise ValueError('Adresse de recette inattendue')
    with tempfile.TemporaryDirectory(prefix='polradar-client-') as work:
        option = 'mcp_servers={ polradar_recette={url='+json.dumps(args.url)+'} }'
        client = subprocess.Popen(['codex','app-server','--listen','stdio://','-c',option,
            '-c','analytics.enabled=false','--disable','plugins','--disable','apps'],cwd=work,
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
        sel=selectors.DefaultSelector()
        sel.register(client.stdout,selectors.EVENT_READ)
        buf=b''
        counter=0
        def send(method,params,notify=False):
            nonlocal buf,counter
            counter+=1
            item={'method':method,'params':params}
            if not notify: item['id']=counter
            client.stdin.write((json.dumps(item)+'\n').encode());client.stdin.flush()
            if notify: return
            end=time.monotonic()+25
            while time.monotonic()<end:
                if b'\n' in buf:
                    row,buf=buf.split(b'\n',1)
                    msg=json.loads(row)
                    if msg.get('id')==counter:
                        if 'error' in msg: raise RuntimeError(f'{method} : erreur du client')
                        return msg['result']
                elif sel.select(max(0,end-time.monotonic())):
                    chunk=os.read(client.stdout.fileno(),65536)
                    if not chunk: break
                    buf+=chunk
            raise TimeoutError(method)
        try:
            send('initialize',{'clientInfo':{'name':'polradar-recette','version':'1'},'capabilities':{'experimentalApi':True}})
            send('initialized',{},True)
            for _ in range(5):
                result=send('mcpServerStatus/list',{'serverName':'polradar_recette','detail':'full'})
                server=next((s for s in result['data'] if s['name']=='polradar_recette'),{})
                if server.get('tools'): break
                time.sleep(1)
            assert len(server.get('tools',{}))==11
            thread=send('thread/start',{'cwd':work,'ephemeral':True,'approvalPolicy':'never','sandbox':'read-only'})['thread']['id']
            def search(arguments):
                result=send('mcpServer/tool/call',{'threadId':thread,'server':'polradar_recette','tool':'polradar_search','arguments':arguments})
                return result.get('result',result)
            args={'query':'logement','limit':1}
            first=search(args)['structuredContent']
            assert first['donnees']['resultats'][0]['source']['url'].startswith('https://')
            second=search(dict(args,offset=1,expectedRevision=first['revisionDuSite']))['structuredContent']
            assert second['revisionDuSite']==first['revisionDuSite'] and second['donnees']['offset']==1
            assert search({'limit':999}).get('isError') is True
            print('Codex : onze outils découverts, deux pages, source officielle et erreur contrôlée.')
        finally:
            sel.close()
            client.terminate()
            try: client.wait(timeout=3)
            except subprocess.TimeoutExpired: client.kill();client.wait()


if __name__=='__main__': main()
