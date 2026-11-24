#!/usr/bin/env python3
"""Transfer only the validated JSON inputs between the two daily workflow jobs."""
import argparse
import hashlib
import re
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
    bases = {}
    for status, name in zip(changed[::2], changed[1::2]):
        path = Path(name)
        if status != 'M' or path.parent != Path('src/data') or path.name not in ALLOWED:
            raise ValueError('Modification hors des fichiers quotidiens')
        raw = payload(ROOT / path)
        base = subprocess.check_output(['git', 'show', 'HEAD:' + name], cwd=ROOT)
        bases[path.name] = {'hash': hashlib.sha256(base).hexdigest()}
        if path.name == 'sources.json':
            original, new = json.loads(base), json.loads(raw)
            if (not isinstance(original, list) or not isinstance(new, list)
                    or new[:len(original)] != original or len(new) <= len(original)):
                raise ValueError('Le collecteur peut uniquement ajouter des notices au catalogue des sources')
            bases[path.name]['originalCount'] = len(original)
        files[path.name] = raw
    if not files:
        return False
    ARTIFACT.mkdir(parents=True, exist_ok=False)
    (ARTIFACT / 'bases.json').write_text(json.dumps(bases))
    for name, raw in files.items():
        (ARTIFACT / name).write_bytes(raw)
    return True


def apply():
    if ARTIFACT.is_symlink() or not ARTIFACT.is_dir():
        raise ValueError('Artefact quotidien absent ou indirect')
    files = {path.name: path for path in ARTIFACT.iterdir()}
    manifest = files.pop('bases.json', None)
    if not manifest or not files or not files.keys() <= ALLOWED:
        raise ValueError('Artefact hors des fichiers quotidiens')
    bases = json.loads(payload(manifest))
    if not isinstance(bases, dict) or bases.keys() != files.keys():
        raise ValueError('Inventaire incohérent')
    inputs = []
    for name, path in sorted(files.items()):
        raw = payload(path)
        target = DATA / name
        existing = payload(target)
        reference = bases[name]
        if not isinstance(reference, dict) or not re.fullmatch(r'[0-9a-f]{64}', str(reference.get('hash', ''))):
            raise ValueError('Référence de départ invalide')
        same_base = hashlib.sha256(existing).hexdigest() == reference['hash']
        if name == 'sources.json':
            previous, proposed = json.loads(existing), json.loads(raw)
            count = reference.get('originalCount')
            if (type(count) is not int or not isinstance(previous, list) or not isinstance(proposed, list)
                    or not 0 <= count < len(proposed) or (same_base and previous != proposed[:count])):
                raise ValueError('Ajout de sources invalide')
            by_id = {s['id']: s for s in previous}
            added = set()
            for row in proposed[count:]:
                if not isinstance(row, dict):
                    raise ValueError('Notice invalide')
                ident = row.get('id')
                if (not isinstance(ident, str) or not re.fullmatch(r'notice-commission-[0-9]{4,6}[a-z]?', ident)
                        or row.get('kind') != 'institution' or not isinstance(row.get('url'), str)
                        or not re.fullmatch(r'https://www\.commission-des-sondages\.fr/notices/medias/fichiers/add/[1-9][0-9]{0,6}', row['url'])
                        or ident in added):
                    raise ValueError('Notice hors de la collection autorisée')
                added.add(ident)
                if ident in by_id and (same_base or by_id[ident] != row):
                    raise ValueError('Notice déjà présente ou modifiée pendant la collecte')
                if ident not in by_id:
                    previous.append(row)
                    by_id[ident] = row
            if not same_base:
                raw = (json.dumps(previous, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
                if len(raw) > MAX_SIZE:
                    raise ValueError('Catalogue fusionné trop volumineux')
        elif not same_base:
            raise ValueError('Données modifiées durant la collecte ; relancer sur main')
        inputs.append((name, raw))
    for name, raw in inputs:
        (DATA / name).write_bytes(raw)
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
