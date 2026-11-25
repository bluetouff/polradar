"""Mesure les quatre plafonds d'une édition statique et les postes principaux."""
import argparse
from collections import Counter
import hashlib
import json
import pathlib
import runpy
import tempfile

DEPLOY = runpy.run_path(pathlib.Path(__file__).resolve().parents[1] / 'deploy/pull-release.py')


def measure(raw):
    groups = Counter()
    counts = Counter()
    digests = set()
    duplicate_bytes = 0
    with DEPLOY['bounded_tar'](raw) as bundle:
        members = bundle.getmembers()
        expanded = bundle.fileobj.seek(0, 2)
        for member in members:
            key, _, rest = member.name.partition('/')
            group = key if rest else 'Racine'
            groups[group] += member.size
            counts[group] += 1
            digest = hashlib.sha256(bundle.extractfile(member).read()).digest()
            if digest in digests:
                duplicate_bytes += member.size
            digests.add(digest)
        largest = max(members, key=lambda member: member.size)
    return (
        [
            ('Archive gzip (octets)', len(raw), DEPLOY['MAX_ARCHIVE']),
            ('TAR complet (octets)', expanded, DEPLOY['MAX_EXPANDED']),
            ('Fichiers', len(members), DEPLOY['MAX_FILES']),
            ('Plus grand fichier (octets)', largest.size, DEPLOY['MAX_FILE']),
        ],
        largest.name,
        [(name, counts[name], size) for name, size in groups.most_common()],
        duplicate_bytes,
    )


def report(capacity):
    rows, largest, groups, duplicates = capacity
    lines = [
        '| Déploiement | Utilisé | Plafond | Marge |',
        '| --- | ---: | ---: | ---: |',
    ]
    for label, used, limit in rows:
        remaining = limit - used
        lines.append(f'| {label} | {used:,} | {limit:,} | {remaining:,} ({remaining / limit:.1%}) |')
    lines.extend(['', f'Plus grand fichier : `{largest}`.',
                  f'Contenu strictement identique à d’autres fichiers : {duplicates:,} octets.',
                  '', '| Poste | Fichiers | Octets hors en-têtes TAR |', '| --- | ---: | ---: |'])
    lines.extend(f'| {name} | {count:,} | {size:,} |' for name, count, size in groups[:12])
    return '\n'.join(lines) + '\n'


def capacity_data(capacity, revision):
    rows, largest, groups, duplicates = capacity
    return {
        'version': 1, 'sourceCommit': revision,
        'limits': {name: {'used': used, 'limit': limit} for name, used, limit in rows},
        'largest': largest,
        'groups': {name: {'files': count, 'bytes': total} for name, count, total in groups},
        'duplicateBytes': duplicates,
    }


def growth(current, previous_path):
    if not previous_path:
        return ''
    with pathlib.Path(previous_path).open('rb') as previous:
        raw = previous.read(65537)
    if len(raw) > 65536:
        raise ValueError('Capacity baseline too large')
    baseline = json.loads(raw)
    revision = baseline.get('sourceCommit', '')
    if baseline.get('version') != 1 or not DEPLOY['SHA'].fullmatch(revision):
        raise ValueError('Invalid capacity baseline provenance')
    before = baseline.get('limits', {})
    lines = [f'Croissance depuis `{revision}`.', '', '| Limite | Variation |', '| --- | ---: |']
    for label, values in current['limits'].items():
        used = values['used']
        prior = before.get(label, {}).get('used')
        if type(prior) is not int or prior <= 0:
            raise ValueError('Invalid previous capacity')
        delta = used - prior
        if delta >= max(prior * 0.1, values['limit'] * 0.02):
            print(f'::warning::{label}: hausse de {delta:,} ({delta / prior:.1%}) à examiner.')
        lines.append(f'| {label} | {delta:+,} ({delta / prior:+.1%}) |')
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=pathlib.Path)
    parser.add_argument('--checksum', required=True, type=pathlib.Path)
    parser.add_argument('--revision', required=True)
    args = parser.parse_args()
    if args.archive.stat().st_size > DEPLOY['MAX_ARCHIVE'] or args.checksum.stat().st_size > 1024:
        raise ValueError('Fichier au-delà du plafond')
    raw = args.archive.read_bytes()
    wanted = args.checksum.read_text(encoding='ascii').split()
    if len(wanted) != 2 or wanted[1] != args.archive.name or hashlib.sha256(raw).hexdigest() != wanted[0]:
        raise ValueError('Empreinte de publication incohérente')
    with tempfile.TemporaryDirectory(prefix='polradar-capacite-') as checked:
        DEPLOY['extract_static'](raw, pathlib.Path(checked), args.revision)
    print(report(measure(raw)), end='')


if __name__ == '__main__':
    main()
