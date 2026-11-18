#!/usr/bin/env python3
"""Rebuild two GoAccess aggregates from dedicated HTTPS logs. No persistence merge."""
from datetime import datetime, timezone
import gzip
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile

LOG_DIR = Path('/var/log/polradar')
REPORT = Path('/var/lib/polradar-stats/report.json')
RUNTIME = Path('/run/polradar-stats')
GOACCESS = '/usr/bin/goaccess'
MAX_BYTES = 512 * 1024 * 1024
PANELS = ('visitors', 'requests', 'static_requests', 'not_found', 'visit_time', 'referring_sites', 'browsers', 'status_codes')


def count(value):
    if type(value) not in (int, float) or not math.isfinite(value) or value < 0 or int(value) != value or value > 2**53 - 1:
        raise ValueError('Invalid GoAccess metric')
    return int(value)


def rows(raw, panel):
    data = raw.get(panel, {}).get('data', [])
    if not isinstance(data, list) or len(data) > 10000:
        raise ValueError('Invalid GoAccess panel')
    result = []
    for row in data:
        label = str(row['data'])
        if panel == 'visitors':
            if not re.fullmatch(r'\d{8}', label):
                raise ValueError('Unsupported GoAccess date grain')
            label = datetime.strptime(label, '%Y%m%d').date().isoformat()
        elif panel in ('requests', 'static_requests', 'not_found'):
            label = label.split('?', 1)[0].split('#', 1)[0][:500]
            if not label.startswith('/') or label.startswith('//'):
                label = '(requête hors chemin local)'
        elif panel == 'referring_sites':
            # Keep only a domain. No referring URL, query, IP address or credential.
            if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,63}', label) or re.search(r'\d+\.\d+\.\d+\.\d+', label):
                label = '(référent non retenu)'
        else:
            label = re.sub(r'[\x00-\x1f\x7f]', '', label)[:160]
        result.append({'label': label, 'hits': count(row['hits']['count']), 'profiles': count(row['visitors']['count']), 'bytes': count(row['bytes']['count'])})
        if result[-1]['profiles'] > result[-1]['hits']:
            raise ValueError('Inconsistent GoAccess profiles')
    return result


def qualify(raw):
    if not isinstance(raw.get('general'), dict):
        raise ValueError('Missing GoAccess summary')
    panels = {panel: rows(raw, panel) for panel in PANELS}
    if not panels['visitors']:
        raise ValueError('No daily observations from GoAccess')
    panels['visitors'].sort(key=lambda row: row['label'])
    panels['visit_time'].sort(key=lambda row: row['label'])
    if len({r['label'] for r in panels['visitors']}) != len(panels['visitors']):
        raise ValueError('Duplicate daily observations')
    requests = sum(r['hits'] for r in panels['visitors'])
    profiles = sum(r['profiles'] for r in panels['visitors'])
    if requests != count(raw['general']['valid_requests']) or profiles != count(raw['general']['unique_visitors']):
        raise ValueError('Daily metrics disagree with GoAccess summary')
    return {'requests': requests, 'dailyProfiles': profiles, 'bytes': sum(r['bytes'] for r in panels['visitors']), 'panels': panels}


def aggregate(spool, output, without_bots):
    command = [GOACCESS, '-', '--no-global-config', '--log-format=%h %^[%x] "%r" %s %b "%R" "%u"', '--datetime-format=%d/%b/%Y:%H:%M:%S %z', '--no-query-string', '--anonymize-ip', '--max-items=10000', '--tz=Europe/Paris', f'--output={output}']
    for panel in ('HOSTS', 'REFERRERS', 'REMOTE_USER', 'GEO_LOCATION', 'ASN'):
        command.append(f'--ignore-panel={panel}')
    if without_bots:
        command.append('--ignore-crawlers')
    with spool.open('rb') as incoming:
        process = subprocess.run(command, stdin=incoming, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=120, check=False)
    if process.returncode or not output.is_file() or output.stat().st_size > 20 * 1024 * 1024:
        raise ValueError('GoAccess generation failed; previous report retained')
    raw = json.loads(output.read_text())
    # A log containing only known crawlers legitimately has no filtered daily rows.
    if without_bots and not raw.get('visitors', {}).get('data'):
        if not isinstance(raw.get('general'), dict):
            raise ValueError('Invalid filtered summary')
        if count(raw['general']['valid_requests']) or count(raw['general']['unique_visitors']):
            raise ValueError('Missing filtered observations')
        return {'requests': 0, 'dailyProfiles': 0, 'bytes': 0, 'panels': {panel: [] for panel in PANELS}}
    return qualify(raw)


def generate(log_dir=LOG_DIR, report=REPORT, runtime=RUNTIME):
    os.umask(0o027)
    files = sorted(p for p in log_dir.iterdir() if re.fullmatch(r'access\.log(?:\.\d+(?:\.gz)?)?', p.name))
    if len(files) > 30 or any(p.is_symlink() or not p.is_file() for p in files):
        raise ValueError('Unexpected access-log set')
    payload = {'schemaVersion': 1, 'generatedAt': datetime.now(timezone.utc).isoformat(), 'engine': 'GoAccess', 'status': 'waiting', 'logFiles': len(files), 'all': None, 'withoutKnownBots': None}
    with tempfile.TemporaryDirectory(dir=runtime, prefix='build-') as temporary:
        directory = Path(temporary)
        spool = directory / 'input.log'
        size = 0
        with spool.open('wb') as output:
            for path in files:
                opener = gzip.open if path.suffix == '.gz' else open
                with opener(path, 'rb') as incoming:
                    while chunk := incoming.read(1024 * 1024):
                        size += len(chunk)
                        if size > MAX_BYTES:
                            raise ValueError('Access logs exceed the reviewed generation limit')
                        output.write(chunk)
        if size:
            payload['all'] = aggregate(spool, directory / 'all.json', False)
            payload['withoutKnownBots'] = aggregate(spool, directory / 'filtered.json', True)
            if payload['withoutKnownBots']['requests'] > payload['all']['requests']:
                raise ValueError('Inconsistent crawler-filtered total')
            payload['status'] = 'ready'
            payload['firstDate'] = payload['all']['panels']['visitors'][0]['label']
            payload['lastDate'] = payload['all']['panels']['visitors'][-1]['label']
        temporary_report = report.with_suffix('.tmp')
        try:
            with temporary_report.open('x', encoding='utf-8') as output:
                json.dump(payload, output, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
                output.write('\n')
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary_report, report)
        finally:
            temporary_report.unlink(missing_ok=True)
    return payload


if __name__ == '__main__':
    try:
        generate()
    except Exception as error:
        # Parsing errors may contain raw requests. Never emit their messages.
        raise SystemExit(f'GoAccess: {type(error).__name__}; previous report retained') from None
