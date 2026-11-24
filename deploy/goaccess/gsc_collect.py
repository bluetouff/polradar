"""Daily, private Search Console report for the URL-prefix property of Polradar."""
from datetime import date, datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, ProxyHandler, Request
from zoneinfo import ZoneInfo

PROPERTY = 'https://polradar.fr/'
API = 'https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fpolradar.fr%2F/searchAnalytics/query'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
MAX_ROWS = 1000
MAX_PAIRS = 250
PAIR = ('query', 'page')
DIMENSIONS = {None: (), 'date': ('date',), 'query': ('query',), 'page': ('page',), PAIR: PAIR}
STATE = Path('/var/lib/polradar-gsc')
REPORT = Path('/var/lib/polradar-gsc-report/report.html')


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def post(url, payload, headers):
    if url not in (API, TOKEN_URL):
        raise ValueError('Unexpected endpoint')
    opener = build_opener(ProxyHandler({}), NoRedirect())
    req = Request(url, data=payload, headers=headers, method='POST')
    with opener.open(req, timeout=15) as response:
        if response.headers.get_content_type() != 'application/json':
            raise ValueError('Unexpected API response')
        raw = response.read(4_000_001)
        if len(raw) > 4_000_000:
            raise ValueError('Oversize API response')
        return json.loads(raw)


def access_token(info, now):
    # Signing uses the distribution's Google Auth library. Ignore credential URLs
    # and never use delegated users or scopes provided by a credential file.
    from google.auth import crypt, jwt
    email = info.get('client_email', '')
    if info.get('type') != 'service_account' or not re.fullmatch(r'[a-z0-9.-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com', email):
        raise ValueError('Dedicated service account required')
    signer = crypt.RSASigner.from_string(info['private_key'], key_id=info.get('private_key_id'))
    issued = int(now.timestamp())
    assertion = jwt.encode(signer, {'iss': email, 'scope': SCOPE, 'aud': TOKEN_URL, 'iat': issued, 'exp': issued + 900})
    reply = post(TOKEN_URL, urlencode({'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion': assertion}).encode('ascii'), {'Content-Type': 'application/x-www-form-urlencoded'})
    token = reply.get('access_token')
    if reply.get('token_type', '').lower() != 'bearer' or not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9._~+/=-]{10,4096}', token):
        raise ValueError('Invalid authorization response')
    return token


def search(token, start, end, dimension, limit):
    dims = DIMENSIONS[dimension]
    payload = {'startDate': start.isoformat(), 'endDate': end.isoformat(), 'type': 'web', 'dataState': 'final',
               'aggregationType': 'auto' if 'page' in dims else 'byProperty', 'rowLimit': limit}
    if dims:
        payload['dimensions'] = list(dims)
    return post(API, json.dumps(payload).encode('ascii'), {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token})


def rows(reply, dimension, start, end, limit):
    dims = DIMENSIONS[dimension]
    # With a page dimension Google groups by canonical URI. Its response may echo auto.
    aggregations = ('byPage', 'auto') if 'page' in dims else ('byProperty',)
    if not isinstance(reply, dict) or 'error' in reply or reply.get('responseAggregationType') not in aggregations:
        raise ValueError('Invalid Search Analytics response')
    raw_rows = reply.get('rows', [])
    if not isinstance(raw_rows, list) or len(raw_rows) > limit:
        raise ValueError('Invalid row count')
    seen, result = set(), []
    for row in raw_rows:
        if not isinstance(row, dict):
            raise ValueError('Invalid Search Analytics row')
        item = {}
        for field in ('clicks', 'impressions', 'ctr', 'position'):
            v = row.get(field)
            if type(v) not in (int, float) or v < 0 or v > 2**53 - 1 or not math.isfinite(v):
                raise ValueError('Invalid metric')
            if field in ('clicks', 'impressions'):
                if v != int(v):
                    raise ValueError('Invalid count')
                v = int(v)
            item[field] = v
        if item['ctr'] > 1 or item['clicks'] > item['impressions'] or (item['impressions'] and item['position'] < 1):
            raise ValueError('Invalid Search Analytics metrics')
        keys = row.get('keys', [])
        if not isinstance(keys, list) or len(keys) != len(dims):
            raise ValueError('Unexpected dimensions')
        for field, key in zip(dims, keys):
            if not isinstance(key, str) or not key or len(key) > 4096 or any(ord(c) < 32 or ord(c) == 127 for c in key):
                raise ValueError('Invalid dimension value')
            if field == 'date':
                day = date.fromisoformat(key)
                if key != day.isoformat() or not start <= day <= end:
                    raise ValueError('Date outside the requested period')
            if field == 'page' and (not key.startswith(PROPERTY) or urlsplit(key).netloc != 'polradar.fr'):
                raise ValueError('Page outside the selected property')
            item[field if len(dims) > 1 else 'key'] = key
        identity = tuple(keys)
        if identity in seen:
            raise ValueError('Duplicate dimensions')
        seen.add(identity)
        result.append(item)
    return result


def collect(query, now):
    yesterday = now.astimezone(ZoneInfo('America/Los_Angeles')).date() - timedelta(days=1)
    discovery_start = yesterday - timedelta(days=41)
    daily = rows(query(discovery_start, yesterday, 'date', 42), 'date', discovery_start, yesterday, 42)
    last = max((date.fromisoformat(r['key']) for r in daily), default=yesterday)
    start = last - timedelta(days=27)
    def rollup(dimension, limit):
        return rows(query(start, last, dimension, limit), dimension, start, last, limit)
    totals = rollup(None, 1)
    # Ask again when the final 28-day range extends beyond the discovery window.
    if start < discovery_start:
        series = rollup('date', 28)
    else:
        series = [r for r in daily if r['key'] >= start.isoformat()]
    series.sort(key=lambda r: r['key'])
    queries, pages = rollup('query', MAX_ROWS), rollup('page', MAX_ROWS)
    if not totals and (series or queries or pages):
        raise ValueError('Missing property totals')
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=27)

    def extra(first, final, dimension, limit):
        # An unavailable optional breakdown must not discard the current property report.
        try:
            return rows(query(first, final, dimension, limit), dimension, first, final, limit)
        except (ValueError, OSError):
            return None

    previous_pages = extra(previous_start, previous_end, 'page', MAX_ROWS)
    pairs = extra(start, last, PAIR, MAX_PAIRS) if queries and pages else []
    return {'fetchedAt': now.isoformat(), 'startDate': start.isoformat(), 'endDate': last.isoformat(),
            'daily': series, 'totals': totals[0] if totals else None, 'queries': queries, 'pages': pages,
            'previous': {'startDate': previous_start.isoformat(), 'endDate': previous_end.isoformat(),
                         'pages': previous_pages}, 'queryPages': pairs}


def publish(path, content, mode):
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.pending-')
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(content)
            stream.flush()
            os.fchmod(stream.fileno(), mode)
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def refresh(reader, render, state, report, now):
    snapshot_file = state / 'last.json'
    try:
        snapshot = reader()
        html = render(snapshot, now.isoformat())
        publish(snapshot_file, json.dumps(snapshot, ensure_ascii=False).encode('utf-8'), 0o600)
        publish(report, html, 0o640)
        return True
    except Exception as exc:
        # Never include HTTP bodies, URL queries, errors from the signer or source rows in logs.
        last = None
        try:
            last = json.loads(snapshot_file.read_bytes())
        except (OSError, ValueError):
            pass
        publish(report, render(last, now.isoformat(), failed=True), 0o640)
        print('Search Console indisponible' + (f' (HTTP {exc.code})' if isinstance(exc, HTTPError) else ''), file=sys.stderr)
        return False


def main():
    # -I excludes the script directory. Load this one reviewed sibling explicitly.
    from runpy import run_path
    render = run_path(str(Path(__file__).with_name('gsc_view.py')))['render']
    now = datetime.now(timezone.utc)
    def fetch():
        path = Path(os.environ['CREDENTIALS_DIRECTORY']) / 'reader.json'
        if path.stat().st_size > 32768:
            raise ValueError('Invalid credential')
        token = access_token(json.loads(path.read_bytes()), now)
        return collect(lambda a, b, d, limit: search(token, a, b, d, limit), now)
    return 0 if refresh(fetch, render, STATE, REPORT, now) else 1


if __name__ == '__main__':
    raise SystemExit(main())
