"""Bounded HTTP validators. The cache contains digests, validators and retry times only."""
from datetime import timezone
from email.utils import parsedate_to_datetime
import hashlib
import json
from pathlib import Path
import re
import threading
import time

DIGEST = re.compile(r'[0-9a-f]{64}')
ETAG = re.compile(r'(?:W/)?"[\x21\x23-\x7e]{0,154}"')


def key(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def http_date(value):
    if not isinstance(value, str) or len(value) > 80 or not re.fullmatch(r'[ -~]+', value):
        return None
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is not None:
            return parsed.astimezone(timezone.utc).timestamp()
    except (ValueError, OverflowError, TypeError, OSError):
        pass
    return None


def retry_at(value, now):
    """Avoid an immediate retry; a missing delay gets a one-hour publisher backoff."""
    if isinstance(value, str) and re.fullmatch(r'\d{1,12}', value):
        return int(now + max(1, int(value)))
    expiry = http_date(value)
    return int(expiry) if expiry and expiry > now else int(now + 3600)


class State:
    def __init__(self, filename=None):
        self.path = Path(filename) if filename else None
        self.lock = threading.RLock()
        self.records = {}
        self.hosts = {}
        if self.path and self.path.exists():
            if self.path.is_symlink() or not self.path.is_file() or self.path.stat().st_size > 1024 * 1024:
                raise ValueError('Cache HTTP hors limites')
            raw = json.loads(self.path.read_text())
            if not isinstance(raw, dict) or raw.get('version') != 1:
                raise ValueError('Version du cache HTTP inconnue')
            records, hosts = raw.get('records'), raw.get('hosts')
            if not isinstance(records, dict) or len(records) > 1600 or not isinstance(hosts, dict) or len(hosts) > 1000:
                raise ValueError('Inventaire du cache HTTP invalide')
            for ident, row in records.items():
                if (not DIGEST.fullmatch(ident) or not isinstance(row, dict)
                    or set(row) - {'entity', 'digest', 'etag', 'modified'}
                    or not DIGEST.fullmatch(str(row.get('entity', ''))) or not DIGEST.fullmatch(str(row.get('digest', '')))
                    or ('etag' in row and not ETAG.fullmatch(str(row['etag'])))
                    or ('modified' in row and http_date(row['modified']) is None)):
                    continue
                self.records[ident] = row
            self.hosts = {h:v for h,v in hosts.items() if DIGEST.fullmatch(h) and type(v) is int and v > time.time()}

    def get(self, purpose, url):
        with self.lock:
            return self.records.get(key(purpose + '\n' + url), {})

    def remember(self, purpose, url, response, digest):
        if not self.path or not DIGEST.fullmatch(digest):
            return
        tag = response.get('etag')
        modified = response.get('modified')
        entry = {'entity': response['entity'], 'digest': digest}
        if isinstance(tag, str) and ETAG.fullmatch(tag):
            entry['etag'] = tag
        if http_date(modified) is not None:
            entry['modified'] = modified
        with self.lock:
            ident = key(purpose + '\n' + url)
            self.records.pop(ident, None)
            if 'etag' in entry or 'modified' in entry:
                self.records[ident] = entry

    def defer(self, host, value):
        with self.lock:
            ident = key(host)
            self.hosts[ident] = max(self.hosts.get(ident, 0), retry_at(value, time.time()))

    def deferred(self, host):
        with self.lock:
            return self.hosts.get(key(host), 0) > time.time()

    def save(self):
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {'version':1,'records':dict(list(self.records.items())[-1600:]), 'hosts':{k:v for k,v in self.hosts.items() if v > time.time()}}
        raw = json.dumps(data, separators=(',', ':'))
        if len(raw) > 1024 * 1024:
            raise ValueError('Cache HTTP hors limites')
        tmp = self.path.with_suffix('.tmp')
        with tmp.open('x') as out:
            out.write(raw)
        tmp.replace(self.path)


def headers(row, url):
    if not isinstance(row, dict) or row.get('entity') != key(url) or not DIGEST.fullmatch(str(row.get('digest', ''))):
        return {}
    result = {}
    tag = row.get('etag')
    if isinstance(tag, str) and ETAG.fullmatch(tag):
        result['If-None-Match'] = tag
    if http_date(row.get('modified')) is not None:
        result['If-Modified-Since'] = row['modified']
    return result
