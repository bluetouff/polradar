#!/usr/bin/env python3
"""Collect official Arcom files for review. Never modify or publish site data."""
import calendar
from datetime import datetime
from zoneinfo import ZoneInfo
import hashlib
from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path
import re
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
HOSTS = {'www.arcom.fr'}
spec = importlib.util.spec_from_file_location('source_transport', ROOT / 'scripts/watch-sources.py')
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)


class Settings(HTMLParser):
    def __init__(self):
        super().__init__(); self.capture = False; self.blocks = []; self.current = []
    def handle_starttag(self, tag, attrs):
        if tag == 'script' and dict(attrs).get('data-drupal-selector') == 'drupal-settings-json':
            self.capture = True; self.current = []
    def handle_data(self, value):
        if self.capture: self.current.append(value)
    def handle_endtag(self, tag):
        if tag == 'script' and self.capture:
            self.blocks.append(''.join(self.current)); self.capture = False


def file_url(path):
    if not isinstance(path, str): raise ValueError('Invalid file path')
    decoded = urllib.parse.unquote(path)
    if not decoded.startswith('/sites/default/files/tphe/files/speaking_time_files/') or not decoded.endswith('.csv') or '..' in decoded or re.search(r'[\x00-\x1f\x7f\\?#]', decoded):
        raise ValueError('Unexpected Arcom file')
    url = 'https://www.arcom.fr' + path
    transport.checked_url(url, HOSTS)
    return url


def source_files(body, year, today):
    parser = Settings(); parser.feed(body.decode('utf-8', errors='strict'))
    if len(parser.blocks) != 1: raise ValueError('Missing or ambiguous Arcom settings')
    data = json.loads(parser.blocks[0]).get('tphpe')
    if not isinstance(data, list) or len(data) != 1 or data[0].get('annee') != year: raise ValueError('Wrong Arcom year')
    months = data[0].get('mois')
    if not isinstance(months, list) or not 1 <= len(months) <= 12: raise ValueError('Invalid month list')
    result = []
    for month in months:
        files = [f for f in month.get('fichiers', []) if f.get('type') == 'uploaded_csv_personnalites']
        if len(files) != 1: raise ValueError('Ambiguous personal speech file')
        f = files[0]
        start = datetime.strptime(f['date_start'], '%d/%m/%Y').date()
        end = datetime.strptime(f['date_end'], '%d/%m/%Y').date()
        if start.year != year or start.day != 1 or end.year != year or end.month != start.month or end.day != calendar.monthrange(year, start.month)[1] or end >= today:
            raise ValueError('Incomplete or wrong period')
        if f.get('format') != 'csv': raise ValueError('Unsupported Arcom format')
        result.append({'month':start.strftime('%Y-%m'), 'sourceUrl':file_url(f.get('file_uri'))})
    if len({r['month'] for r in result}) != len(result): raise ValueError('Duplicated month')
    return sorted(result, key=lambda r:r['month'], reverse=True)[:3]


def recent_files(now):
    files = []
    unavailable = []
    years = (now.year, now.year - 1) if now.month <= 3 else (now.year,)
    for year in years:
        index = f'https://www.arcom.fr/temps-parole/hors-elections/recherche/source/{year}'
        try:
            status, mime, body = transport.fetch_reliably(index, HOSTS)
            if status != 200 or mime not in ('text/html', 'application/xhtml+xml'):
                raise ValueError('Arcom index unavailable')
            files.extend(source_files(body, year, now.date()))
        except (ValueError, KeyError, TypeError, OSError):
            unavailable.append(year)
        if len(files) >= 3:
            break
    if not files:
        raise ValueError('No complete Arcom release')
    return sorted(files, key=lambda row: row['month'], reverse=True)[:3], unavailable


def main():
    now = datetime.now(ZoneInfo('Europe/Paris'))
    output = ROOT / 'artifacts/airtime-review'; output.mkdir(parents=True, exist_ok=True)
    try:
        files, unavailable = recent_files(now)
        for row in files:
            status, mime, raw = transport.fetch_reliably(row['sourceUrl'], HOSTS)
            if status != 200 or mime not in ('text/csv','application/csv','text/plain','application/octet-stream','application/vnd.ms-excel'): raise ValueError('Arcom CSV unavailable')
            text = raw.decode('utf-8-sig', errors='strict')
            if not text.startswith(';Appartenance;') or len(raw) < 1000: raise ValueError('Invalid Arcom CSV')
            row['sha256'] = hashlib.sha256(raw).hexdigest()
            (output / f"{row['month']}.csv").write_bytes(raw)
        previous = json.loads((ROOT / 'src/data/airtime.json').read_text())
        known = {r['month']:r['sha256'] for r in previous['months']}
        changed = any(known.get(row['month']) != row['sha256'] for row in files)
        manifest = {'version':1, 'checked':now.date().isoformat(), 'observedAt':now.isoformat(), 'status':'review' if changed else 'unchanged', 'months':files}
        (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
        report = '# Relevés Arcom\n\n' + ('Nouveaux fichiers ou révisions à examiner.' if changed else 'Les trois derniers fichiers correspondent au relevé intégré.') + '\n\n' + '\n'.join(f"- [{r['month']}]({r['sourceUrl']})" for r in files) + '\n'
        if unavailable:
            report += '\nIndex annuel indisponible : ' + ', '.join(map(str, unavailable)) + '.\n'
    except (ValueError, KeyError, TypeError, OSError):
        # An unsuccessful run cannot leave a stale successful manifest behind.
        (output / 'manifest.json').write_text(json.dumps({'version':1,'checked':now.date().isoformat(),'status':'unavailable','months':[]})+'\n')
        report = '# Relevés Arcom\n\nSource indisponible ou format modifié. Le relevé intégré au site est conservé.\n'
    (output / 'report.md').write_text(report)
    print(report)


if __name__ == '__main__':
    main()
