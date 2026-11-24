"""Mesure les quatre plafonds d'une édition statique et les postes principaux."""
import argparse
from collections import Counter
import hashlib
import pathlib
import runpy
import tempfile

DEPLOY = runpy.run_path(pathlib.Path(__file__).resolve().parents[1] / 'deploy/pull-release.py')


def measure(raw):
    groups = Counter()
    with DEPLOY['bounded_tar'](raw) as bundle:
        members = bundle.getmembers()
        expanded = bundle.fileobj.seek(0, 2)
        for member in members:
            key, _, rest = member.name.partition('/')
            groups[key if rest else 'Racine'] += member.size
        largest = max(members, key=lambda member: member.size)
    return (
        [
            ('Archive gzip (octets)', len(raw), DEPLOY['MAX_ARCHIVE']),
            ('TAR complet (octets)', expanded, DEPLOY['MAX_EXPANDED']),
            ('Fichiers', len(members), DEPLOY['MAX_FILES']),
            ('Plus grand fichier (octets)', largest.size, DEPLOY['MAX_FILE']),
        ],
        largest.name,
        groups.most_common(10),
    )


def report(capacity):
    rows, largest, groups = capacity
    lines = [
        '| Déploiement | Utilisé | Plafond | Marge |',
        '| --- | ---: | ---: | ---: |',
    ]
    for label, used, limit in rows:
        remaining = limit - used
        lines.append(f'| {label} | {used:,} | {limit:,} | {remaining:,} ({remaining / limit:.1%}) |')
    lines.extend(['', f'Plus grand fichier : `{largest}`.', '', '| Postes principaux | Octets hors en-têtes TAR |', '| --- | ---: |'])
    lines.extend(f'| {name} | {size:,} |' for name, size in groups)
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
