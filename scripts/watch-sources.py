#!/usr/bin/env python3
"""Bounded source monitoring. No content execution and no editorial auto-publication."""
import argparse
import concurrent.futures
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import http.client
import importlib.util
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
LARGE_PDF_LIMIT = 24 * 1024 * 1024
LARGE_PDF_URLS = {
    'equinoxe-programme-synthetique': 'https://parti-equinoxe.fr/wp-content/uploads/2026/11/Equinoxe-Lessentiel-Programme-synthetique-pour-lelection-presidentielle.pdf',
    'dlf-famille-2026': 'https://www.debout-la-france.fr/wp-content/uploads/2026/01/Famille-2026_01-02_Livret.pdf',
}
ROOT = Path(__file__).resolve().parents[1]
HOST_LOCKS = {}
HOST_LAST = {}
HOST_LOCK = threading.Lock()
RETRY_STATUSES = {403, 408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527}

spec = importlib.util.spec_from_file_location('collector_http', ROOT / 'scripts/collector_http.py')
http_cache = importlib.util.module_from_spec(spec)
spec.loader.exec_module(http_cache)
STATE = http_cache.State()


def configure_cache(filename):
    global STATE
    STATE = http_cache.State(filename)


def fetch_reliably(url, allowed_hosts, **options):
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
                result = fetch(url, allowed_hosts, **options)
                if result[0] == 429 or result[0] not in RETRY_STATUSES or attempt == 2:
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


def fetch(url, allowed_hosts, *, with_url=False, timeout=45, conditional=None, response_meta=None, stream_pdf=False):
    deadline = time.monotonic() + timeout

    def remaining():
        value = deadline - time.monotonic()
        if value <= 0:
            raise TimeoutError('Source deadline')
        return min(15, value)

    for _ in range(5):
        parts = checked_url(url, allowed_hosts)
        if STATE.deferred(parts.hostname):
            if response_meta is not None:
                response_meta['deferred'] = True
            result = (429, '', b'')
            return (*result, url) if with_url else result
        conditions = http_cache.headers(conditional, url)
        addresses = public_addresses(parts.hostname)
        for address in addresses:
            connection = http.client.HTTPSConnection(parts.hostname, timeout=remaining(), context=ssl.create_default_context())
            raw = None
            response = None
            try:
                # Pin a validated IP while keeping hostname and certificate validation.
                raw = socket.create_connection((address, 443), timeout=remaining())
                tls = ssl.create_default_context().wrap_socket(raw, server_hostname=parts.hostname)
                connection.sock = tls
                raw = None
                connection.sock.settimeout(remaining())
                path = urllib.parse.urlunsplit(('', '', parts.path or '/', parts.query, ''))
                connection.request('GET', path, headers={'User-Agent':'Polradar-Source-Watch/1.0', 'Accept-Encoding':'identity', 'Accept':'text/html,application/pdf;q=0.9,*/*;q=0.1', **conditions})
                response = connection.getresponse()
                status = response.status
                content_type = response.getheader('Content-Type', '').split(';')[0].lower()
                if status in (301, 302, 303, 307, 308):
                    # Some official catalogues emit an HTTP same-host link. Only upgrade;
                    # never make an HTTP request and never relax certificate checks.
                    url = redirect_url(url, response.getheader('Location', ''), allowed_hosts)
                    break
                if status == 429:
                    STATE.defer(parts.hostname, response.getheader('Retry-After'))
                if status == 304 and not conditions:
                    raise ValueError('Réponse 304 sans représentation locale validée')
                if response_meta is not None:
                    response_meta.update(entity=http_cache.key(url), etag=response.getheader('ETag'), modified=response.getheader('Last-Modified'))
                if status != 200:
                    result = (status, content_type, b'')
                    return (*result, url) if with_url else result
                if response.getheader('Content-Encoding', 'identity') not in ('identity', ''):
                    raise ValueError('Unexpected encoding')
                limit = LARGE_PDF_LIMIT if stream_pdf and url in LARGE_PDF_URLS.values() else LIMIT
                if stream_pdf and (response_meta is None or content_type != 'application/pdf'):
                    raise ValueError('Expected a PDF')
                length = response.getheader('Content-Length') or None
                if length is not None and (not re.fullmatch(r'[0-9]{1,16}', length) or int(length) > limit):
                    raise ValueError('Document too large or invalid length')
                chunks, size = [], 0
                digest = hashlib.sha256() if stream_pdf else None
                signature = b''
                # http.client releases connection.sock when the server requests
                # Connection: close. The response still owns a readable socket.
                while not response.isclosed():
                    tls.settimeout(remaining())
                    chunk = response.read1(min(65536, limit + 1 - size))
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > limit:
                        raise ValueError('Document too large')
                    if stream_pdf:
                        signature += chunk[:5 - len(signature)]
                        if not b'%PDF-'.startswith(signature):
                            raise ValueError('Invalid PDF')
                        digest.update(chunk)
                    else:
                        chunks.append(chunk)
                if length is not None and size != int(length):
                    raise ValueError('Incomplete document')
                if stream_pdf:
                    if signature != b'%PDF-':
                        raise ValueError('Invalid PDF')
                    response_meta.update(pdf_sha256=digest.hexdigest(), size=size)
                body = b''.join(chunks)
                result = (status, content_type, body)
                return (*result, url) if with_url else result
            except (OSError, ssl.SSLError):
                if address == addresses[-1]:
                    raise
            finally:
                if response is not None:
                    response.close()
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
    # A recorded alert is not an editorial acceptance of the new document.
    old = previous.get('previousFingerprint') if previous.get('status') == 'modifie' else (previous.get('fingerprint') or previous.get('previousFingerprint'))
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
        purpose = 'veille-1:' + (source.get('watchContentClass') or '') + ':' + (source.get('watchFormat') or '')
        cached = STATE.get(purpose, url) if STATE.path else {}
        meta = {}
        options = {'conditional':cached, 'response_meta':meta} if STATE.path else {}
        stream_pdf = url == LARGE_PDF_URLS.get(source['id'])
        if stream_pdf:
            options.update(response_meta=meta, stream_pdf=True)
        status, content_type, body = fetch_reliably(url, allowed_hosts, **options)
        row.update(httpStatus=status,contentType=content_type,bytes=meta.get('size',len(body)))
        if meta.get('deferred'):
            row.update(httpStatus=None, status='bloque', message='Requête différée après une limitation HTTP 429 de cet éditeur')
            return row
        if status == 304 and http_cache.DIGEST.fullmatch(str(cached.get('digest', ''))):
            digest = cached['digest']
            changed = old is not None and digest != old
            row.update(status='modifie' if changed else 'accessible', fingerprint=digest, message='Document inchangé depuis le contrôle HTTP précédent')
            if not changed and previous.get('reviewedAt') and previous.get('reviewNote'):
                row.update(reviewedAt=previous['reviewedAt'], reviewNote=previous['reviewNote'])
        elif status != 200:
            row.update(status='bloque' if status in (401,403,429) else 'indisponible',message=f'Réponse HTTP {status}')
        else:
            if stream_pdf:
                digest = meta['pdf_sha256']
            elif video:
                digest = youtube_metadata_fingerprint(content_type, body, video)
            else:
                digest = fingerprint(content_type, body, source.get('watchContentClass'))
            if meta:
                STATE.remember(purpose, url, meta, digest)
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


def monitored(source):
    default = source['kind'] in ('campagne', 'parti') or source['id'] == 'sondages'
    return source.get('watch', default)


def initial_references(history):
    refs = {}
    for run in history:
        for row in run.get('sourceChecks', []):
            digest = row.get('initialFingerprint')
            if isinstance(digest, str) and http_cache.DIGEST.fullmatch(digest):
                refs.setdefault(row['sourceId'], digest)
    return refs


def compare_source(source, previous, refs, allowed_hosts):
    # An accepted editorial baseline always wins over a first observation.
    if previous.get('fingerprint') or previous.get('previousFingerprint'):
        return inspect(source, previous, allowed_hosts)
    first = refs.get(source['id'])
    row = inspect(source, {'previousFingerprint': first}, allowed_hosts)
    if not first and row['status'] == 'accessible':
        first = row.get('fingerprint')
    if first:
        row['initialFingerprint'] = first
    return row


def run(output, baseline, selected=None):
    sources = json.loads((ROOT/'src/data/sources.json').read_text())
    allowed_hosts = {urllib.parse.urlsplit(source['url']).hostname for source in sources}
    targets = [source for source in sources if monitored(source)]
    if selected:
        if not set(selected).issubset({source['id'] for source in targets}):
            raise ValueError('Unknown source')
        targets = [source for source in targets if source['id'] in selected]
    previous = {row['sourceId']:row for row in json.loads(baseline.read_text())} if baseline.exists() else {}
    history = ROOT / 'src/data/daily-updates.json'
    refs = initial_references(json.loads(history.read_text())) if history.is_file() else {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        rows = list(executor.map(lambda source:compare_source(source, previous.get(source['id'],{}), refs, allowed_hosts), targets))
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
    parser.add_argument('--cache',type=Path)
    args=parser.parse_args()
    configure_cache(args.cache)
    run(args.output,args.baseline,args.source)
    STATE.save()
