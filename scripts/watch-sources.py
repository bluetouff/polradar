#!/usr/bin/env python3
"""Bounded source monitoring. No content execution and no editorial auto-publication."""
import argparse
import concurrent.futures
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import http.client
import ipaddress
import json
from pathlib import Path
import re
import socket
import ssl
import time
import urllib.parse

LIMIT = 3 * 1024 * 1024
ROOT = Path(__file__).resolve().parents[1]


def checked_url(url, allowed_hosts):
    if not isinstance(url, str) or re.search(r'[\x00-\x20\x7f\\]', url):
        raise ValueError('Invalid URL')
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != 'https' or parts.username is not None or parts.password is not None or parts.port is not None or parts.hostname not in allowed_hosts:
        raise ValueError('Untrusted URL')
    return parts


def public_addresses(host):
    addresses = list(dict.fromkeys(item[4][0] for item in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)))
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError('Non-public address')
    return addresses[:4]


def redirect_url(current, location, allowed_hosts):
    if not location:
        raise ValueError('Missing redirect')
    origin = checked_url(current, allowed_hosts)
    destination = urllib.parse.urlsplit(urllib.parse.urljoin(current, location))
    if destination.scheme == 'http' and destination.hostname == origin.hostname and destination.port is None:
        destination = destination._replace(scheme='https', fragment='')
    result = urllib.parse.urlunsplit(destination)
    checked_url(result, allowed_hosts)
    return result


def fetch(url, allowed_hosts):
    deadline = time.monotonic() + 45

    def remaining():
        value = deadline - time.monotonic()
        if value <= 0:
            raise TimeoutError('Source deadline')
        return min(15, value)

    for _ in range(5):
        parts = checked_url(url, allowed_hosts)
        addresses = public_addresses(parts.hostname)
        response = None
        for address in addresses:
            connection = http.client.HTTPSConnection(parts.hostname, timeout=remaining(), context=ssl.create_default_context())
            raw = None
            try:
                # Pin a validated IP while keeping hostname and certificate validation.
                raw = socket.create_connection((address, 443), timeout=remaining())
                connection.sock = ssl.create_default_context().wrap_socket(raw, server_hostname=parts.hostname)
                raw = None
                connection.sock.settimeout(remaining())
                path = urllib.parse.urlunsplit(('', '', parts.path or '/', parts.query, ''))
                connection.request('GET', path, headers={'User-Agent':'Polradar-Source-Watch/1.0', 'Accept-Encoding':'identity', 'Accept':'text/html,application/pdf;q=0.9,*/*;q=0.1'})
                response = connection.getresponse()
                status = response.status
                content_type = response.getheader('Content-Type', '').split(';')[0].lower()
                if status in (301, 302, 303, 307, 308):
                    # Some official catalogues emit an HTTP same-host link. Only upgrade;
                    # never make an HTTP request and never relax certificate checks.
                    url = redirect_url(url, response.getheader('Location', ''), allowed_hosts)
                    break
                if status != 200:
                    return status, content_type, b''
                if response.getheader('Content-Encoding', 'identity') not in ('identity', ''):
                    raise ValueError('Unexpected encoding')
                length = response.getheader('Content-Length')
                if length and int(length) > LIMIT:
                    raise ValueError('Document too large')
                chunks, size = [], 0
                while True:
                    connection.sock.settimeout(remaining())
                    chunk = response.read(min(65536, LIMIT + 1 - size))
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > LIMIT:
                        raise ValueError('Document too large')
                    chunks.append(chunk)
                body = b''.join(chunks)
                return status, content_type, body
            except (OSError, ssl.SSLError):
                if address == addresses[-1]:
                    raise
            finally:
                connection.close()
                if raw is not None:
                    raw.close()
        else:
            raise ValueError('No response')
    raise ValueError('Redirect limit')


class Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ignored = 0
        self.parts = []
        self.skip = {'script','style','nav','header','footer','svg','noscript','form'}
    def handle_starttag(self, tag, attrs):
        if tag in self.skip:
            self.ignored += 1
    def handle_endtag(self, tag):
        if tag in self.skip and self.ignored:
            self.ignored -= 1
    def handle_data(self, value):
        if not self.ignored:
            self.parts.append(value)


def fingerprint(content_type, body):
    if content_type == 'application/pdf':
        if not body.startswith(b'%PDF-'):
            raise ValueError('Invalid PDF')
        return hashlib.sha256(body).hexdigest()
    if content_type not in ('text/html','application/xhtml+xml'):
        raise ValueError('Unsupported document')
    parser = Text()
    parser.feed(body.decode('utf-8', errors='replace'))
    text = re.sub(r'\s+', ' ', ' '.join(parser.parts)).strip()
    if len(text) < 180 or any(marker in text.lower() for marker in ('just a moment', 'verify you are human', 'enable javascript and cookies', 'access denied', 'vérifiez que vous êtes humain')):
        raise ValueError('Unusable document')
    return hashlib.sha256(text.encode()).hexdigest()


def inspect(source, previous, allowed_hosts):
    now = datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
    old = previous.get('fingerprint') or previous.get('previousFingerprint')
    row = {'sourceId':source['id'], 'checkedAt':now, 'status':'indisponible', 'httpStatus':None, 'fingerprint':None, 'previousFingerprint':old, 'bytes':0, 'contentType':'', 'message':'Connexion indisponible'}
    try:
        status, content_type, body = fetch(source['url'], allowed_hosts)
        row.update(httpStatus=status,contentType=content_type,bytes=len(body))
        if status != 200:
            row.update(status='bloque' if status in (401,403,429) else 'indisponible',message=f'Réponse HTTP {status}')
        else:
            digest = fingerprint(content_type, body)
            changed = old is not None and digest != old
            row.update(status='modifie' if changed else 'accessible',fingerprint=digest,message='Contenu différent du dernier relevé validé' if changed else 'Document accessible lors du relevé')
    except ValueError:
        row.update(status='bloque',message='Document ou destination non exploitable dans le périmètre autorisé')
    except Exception:
        # Exception messages can contain URLs or server details. Never log them.
        pass
    return row


def run(output, baseline, selected=None):
    sources = json.loads((ROOT/'src/data/sources.json').read_text())
    allowed_hosts = {urllib.parse.urlsplit(source['url']).hostname for source in sources}
    targets = [source for source in sources if source['kind'] in ('campagne','parti') or source['id']=='sondages']
    if selected:
        if not set(selected).issubset({source['id'] for source in targets}):
            raise ValueError('Unknown source')
        targets = [source for source in targets if source['id'] in selected]
    previous = {row['sourceId']:row for row in json.loads(baseline.read_text())} if baseline.exists() else {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        rows = list(executor.map(lambda source:inspect(source,previous.get(source['id'],{}),allowed_hosts),targets))
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    counts = {status:sum(row['status']==status for row in rows) for status in ('accessible','modifie','indisponible','bloque')}
    summary = ['## Veille des sources','',f"{len(rows)} sources contrôlées. Relevé technique, sans modification des fiches éditoriales.",'', '| État | Nombre |','|---|---:|', *[f'| {status} | {count} |' for status,count in counts.items()], '', 'Le rapport JSON peut être relu puis intégré dans `src/data/watch.json`. Les changements de contenu nécessitent une vérification éditoriale.', '', '| Source | État | Relevé UTC |', '|---|---|---|']
    # Fixed identifiers only: remote HTML never enters the Actions summary.
    summary.extend(f"| {row['sourceId']} | {row['status']} | {row['checkedAt']} |" for row in rows)
    output.with_suffix('.md').write_text('\n'.join(summary)+'\n')
    print(json.dumps({'sources':len(rows),'statuses':counts}))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'artifacts/watch-report.json')
    parser.add_argument('--baseline',type=Path,default=ROOT/'src/data/watch.json')
    parser.add_argument('--source',action='append')
    args=parser.parse_args()
    run(args.output,args.baseline,args.source)
