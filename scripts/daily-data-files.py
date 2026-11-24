#!/usr/bin/env python3
"""Transfer only the validated JSON inputs between the two daily workflow jobs."""
import argparse
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'src/data'
ARTIFACT = ROOT / 'artifacts/daily-data'
ALLOWED = {'poll-catalogue.json', 'polls.json', 'sources.json', 'prediction-markets.json', 'economy.json', 'airtime.json', 'daily-updates.json'}
MAX_SIZE = 2 * 1024 * 1024


def payload(path):
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= MAX_SIZE:
        raise ValueError('Fichier quotidien absent, indirect ou trop volumineux')
    raw = path.read_bytes()
    if not isinstance(json.loads(raw), (list, dict)):
        raise ValueError('Fichier quotidien hors schéma')
    return raw


def pack():
    changed = subprocess.check_output(
        ['git', 'diff', '--name-status', '--no-renames', '-z', 'HEAD'], cwd=ROOT,
    ).decode('utf-8').split('\0')[:-1]
    if len(changed) % 2:
        raise ValueError('Liste de fichiers modifiés invalide')
    files = {}
    for status, name in zip(changed[::2], changed[1::2]):
        path = Path(name)
        if status != 'M' or path.parent != Path('src/data') or path.name not in ALLOWED:
            raise ValueError('Modification hors des fichiers quotidiens')
        files[path.name] = payload(ROOT / path)
    if not files:
        return False
    ARTIFACT.mkdir(parents=True, exist_ok=False)
    for name, raw in files.items():
        (ARTIFACT / name).write_bytes(raw)
    return True


def apply():
    if ARTIFACT.is_symlink() or not ARTIFACT.is_dir():
        raise ValueError('Artefact quotidien absent ou indirect')
    files = {path.name: path for path in ARTIFACT.iterdir()}
    if not files or not files.keys() <= ALLOWED:
        raise ValueError('Artefact hors des fichiers quotidiens')
    inputs = [(name, payload(path)) for name, path in sorted(files.items())]
    for name, raw in inputs:
        target = DATA / name
        if target.is_symlink() or not target.is_file():
            raise ValueError('Destination quotidienne hors format')
        target.write_bytes(raw)
    subprocess.run(['git', 'add', '--', *[f'src/data/{name}' for name, _ in inputs]], cwd=ROOT, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('pack', 'apply'))
    args = parser.parse_args()
    if args.mode == 'pack':
        print('true' if pack() else 'false')
    else:
        apply()


if __name__ == '__main__':
    main()
