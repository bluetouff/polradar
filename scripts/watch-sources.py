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
import threading
import urllib.parse

LIMIT = 3 * 1024 * 1024
ROOT = Path(__file__).resolve().parents[1]
HOST_LOCKS = {}
HOST_LAST = {}
HOST_LOCK = threading.Lock()
RETRY_STATUSES = {403, 408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527}


def fetch_reliably(url, allowed_hosts):
    """One request at a time per publisher, with bounded availability retries."""
    host = checked_url(url, allowed_hosts).hostname
    with HOST_LOCK:
        lock = HOST_LOCKS.setdefault(host, threading.Lock())
    with lock:
        for attempt in range(3):
            delay = max(0, HOST_LAST.get(host, 0) + 1 - time.monotonic())
            if delay:
                time.sleep(delay)
            try:
                result = fetch(url, allowed_hosts)
                if result[0] not in RETRY_STATUSES or attempt == 2:
                    return result
            except ssl.SSLError:
                raise  # Certificate failures are never worked around.
            except OSError:
                if attempt == 2:
                    raise
            finally:
                HOST_LAST[host] = time.monotonic()
            time.sleep(2 ** attempt)


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
                    chunk = response.read1(min(65536, LIMIT + 1 - size))
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
    def __init__(self, content_class=None):
        super().__init__(convert_charrefs=True)
        self.ignored = 0
        self.parts = []
        self.content_class = content_class
        self.container_tag = None
        self.container_depth = 0
        self.container_closed = False
        self.skip = {'script','style','nav','header','footer','svg','noscript','form'}
    def handle_starttag(self, tag, attrs):
        if self.content_class:
            if self.container_tag is None and self.content_class in (dict(attrs).get('class') or '').split():
                self.container_tag = tag
                self.container_depth = 1
            elif self.container_depth and tag == self.container_tag:
                self.container_depth += 1
        if tag in self.skip:
            self.ignored += 1
    def handle_endtag(self, tag):
        if tag in self.skip and self.ignored:
            self.ignored -= 1
        if self.content_class and self.container_depth and tag == self.container_tag:
            self.container_depth -= 1
            if not self.container_depth:
                self.container_closed = True
    def handle_data(self, value):
        if not self.ignored and (not self.content_class or self.container_depth):
            self.parts.append(value)


def fingerprint(content_type, body, content_class=None):
    if content_type == 'application/pdf':
        if not body.startswith(b'%PDF-'):
            raise ValueError('Invalid PDF')
        return hashlib.sha256(body).hexdigest()
    if content_type not in ('text/html','application/xhtml+xml'):
        raise ValueError('Unsupported document')
    if content_class is not None and not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{0,59}', content_class):
        raise ValueError('Invalid content scope')
    parser = Text(content_class)
    parser.feed(body.decode('utf-8', errors='replace'))
    if content_class and not parser.container_closed:
        raise ValueError('Missing or incomplete document container')
    text = re.sub(r'\s+', ' ', ' '.join(parser.parts)).strip()
    if len(text) < 180 or any(marker in text.lower() for marker in ('just a moment', 'verify you are human', 'enable javascript and cookies', 'access denied', 'vérifiez que vous êtes humain')):
        raise ValueError('Unusable document')
    return hashlib.sha256(text.encode()).hexdigest()


def youtube_metadata_url(url, allowed_hosts):
    parts = checked_url(url, allowed_hosts)
    query = urllib.parse.parse_qs(parts.query, keep_blank_values=True)
    video = query.get('v', [''])[0]
    if parts.hostname != 'www.youtube.com' or parts.path != '/watch' or parts.fragment or set(query) != {'v'} or len(query['v']) != 1 or not re.fullmatch(r'[A-Za-z0-9_-]{11}', video):
        raise ValueError('Invalid canonical video URL')
    return 'https://www.youtube.com/oembed?' + urllib.parse.urlencode({'url':url, 'format':'json'}), video


def youtube_metadata_fingerprint(content_type, body, video):
    if content_type != 'application/json':
        raise ValueError('Unsupported video metadata')
    data = json.loads(body.decode('utf-8'))
    if not isinstance(data, dict) or data.get('type') != 'video' or data.get('provider_name') != 'YouTube' or data.get('provider_url') != 'https://www.youtube.com/':
        raise ValueError('Invalid video provider')
    values = {key:data.get(key) for key in ('title','author_name','author_url')}
    if any(not isinstance(value,str) or not value.strip() or len(value)>1000 or '\x00' in value for value in values.values()):
        raise ValueError('Invalid video metadata')
    author = urllib.parse.urlsplit(values['author_url'])
    if author.scheme != 'https' or author.hostname != 'www.youtube.com' or author.username is not None or author.password is not None or author.port is not None or not (author.path.startswith('/@') or author.path.startswith('/channel/')) or author.query or author.fragment:
        raise ValueError('Invalid video author URL')
    # Only inspect the frame URL to bind the metadata to the requested video.
    # No embedded markup or remote JavaScript is executed, stored or published.
    class Frames(HTMLParser):
        def __init__(self):
            super().__init__(); self.urls = []
        def handle_starttag(self, tag, attrs):
            if tag == 'iframe': self.urls.append(dict(attrs).get('src'))
    markup = data.get('html')
    if not isinstance(markup,str) or len(markup)>10000:
        raise ValueError('Invalid video frame')
    frames = Frames(); frames.feed(markup)
    if len(frames.urls) != 1 or not isinstance(frames.urls[0],str):
        raise ValueError('Missing video frame')
    frame = checked_url(frames.urls[0], {'www.youtube.com'})
    if frame.path != '/embed/' + video:
        raise ValueError('Mismatched video')
    values.update(videoId=video)
    return hashlib.sha256(json.dumps(values,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()


def inspect(source, previous, allowed_hosts):
    now = datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
    old = previous.get('fingerprint') or previous.get('previousFingerprint')
    row = {'sourceId':source['id'], 'checkedAt':now, 'status':'indisponible', 'httpStatus':None, 'fingerprint':None, 'previousFingerprint':old, 'bytes':0, 'contentType':'', 'message':'Connexion indisponible'}
    try:
        video = None
        url = source['url']
        if source.get('watchFormat') == 'youtube-oembed':
            if source.get('watchContentClass') is not None:
                raise ValueError('Conflicting source formats')
            url, video = youtube_metadata_url(url, allowed_hosts)
        elif source.get('watchFormat') is not None:
            raise ValueError('Unsupported source format')
        status, content_type, body = fetch_reliably(url, allowed_hosts)
        row.update(httpStatus=status,contentType=content_type,bytes=len(body))
        if status != 200:
            row.update(status='bloque' if status in (401,403,429) else 'indisponible',message=f'Réponse HTTP {status}')
        else:
            digest = youtube_metadata_fingerprint(content_type, body, video) if video else fingerprint(content_type, body, source.get('watchContentClass'))
            changed = old is not None and digest != old
            message = 'Métadonnées de la vidéo modifiées' if changed else 'Vidéo disponible : métadonnées YouTube accessibles'
            row.update(status='modifie' if changed else 'accessible',fingerprint=digest,message=message if video else ('Contenu différent du dernier relevé validé' if changed else 'Document accessible lors du relevé'))
            if not changed and previous.get('reviewedAt') and previous.get('reviewNote'):
                row.update(reviewedAt=previous['reviewedAt'],reviewNote=previous['reviewNote'])
    except ValueError:
        row.update(status='bloque',message='Document ou destination non exploitable dans le périmètre autorisé')
    except ssl.SSLError:
        row.update(message='Échec de validation TLS')
    except TimeoutError:
        row.update(message='Délai de connexion ou de lecture dépassé après reprises bornées')
    except Exception:
        # Exception messages can contain URLs or server details. Never log them.
        pass
    return row


def run(output, baseline, selected=None):
    sources = json.loads((ROOT/'src/data/sources.json').read_text())
    allowed_hosts = {urllib.parse.urlsplit(source['url']).hostname for source in sources}
    targets = [source for source in sources if source.get('watch', True) and (source['kind'] in ('campagne','parti') or source['id']=='sondages')]
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
