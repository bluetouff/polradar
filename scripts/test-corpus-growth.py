"""Measure documentary growth on a temporary copy of a verified public edition."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from time import monotonic

from release_capacity import DEPLOY, capacity_data, measure

ROOT = Path(__file__).resolve().parents[1]


def grown(original, factor):
    measures = list(original['measures'])
    versions = list(original['versions'])
    for index in range(1, factor):
        prefix = f'recette-capacite-{index}-'
        measures.extend({**row, 'id': prefix + row['id']} for row in original['measures'])
        versions.extend({**row, 'id': prefix + row['id'], 'measureId': prefix + row['measureId']}
                        for row in original['versions'])
    return {**original, 'measures': measures, 'versions': versions}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--checksum', type=Path, required=True)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--mcp', action='store_true', help='Charger aussi chaque corpus avec le service Go')
    args = parser.parse_args()
    if args.archive.stat().st_size > DEPLOY['PARTITIONED_MAX_ARCHIVE'] or args.checksum.stat().st_size > 1024:
        raise ValueError('Reference too large')
    raw = args.archive.read_bytes()
    proof = args.checksum.read_text(encoding='ascii').strip()
    if (not re.fullmatch(r'[0-9a-f]{64}  site\.tar\.gz', proof)
            or hashlib.sha256(raw).hexdigest() != proof[:64]):
        raise ValueError('Reference checksum mismatch')
    print(json.dumps({'reference': capacity_data(measure(raw, args.revision), args.revision)}, ensure_ascii=False), flush=True)
    with tempfile.TemporaryDirectory(prefix='polradar-croissance-') as workspace:
        base = Path(workspace)
        dist = base / 'dist'
        dist.mkdir()
        DEPLOY['extract_static'](raw, dist, args.revision)
        (dist / DEPLOY['CORPUS_PARTS_MANIFEST']).unlink(missing_ok=True)
        path = dist / DEPLOY['CORPUS']
        baseline = path.read_bytes()
        original = json.loads(baseline)
        marker_path = dist / 'build.json'
        marker = json.loads(marker_path.read_bytes())
        for factor in (1, 2, 5):
            document = grown(original, factor)
            body = baseline if factor == 1 else json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
            marker['sha256'][DEPLOY['CORPUS']] = hashlib.sha256(body).hexdigest()
            path.write_bytes(body)
            marker_path.write_text(json.dumps(marker), encoding='utf-8')
            started = monotonic()
            env = dict(os.environ, GITHUB_SHA=args.revision, GSC_VERIFICATION_FILE='')
            env.pop('GITHUB_STEP_SUMMARY', None)
            env.pop('POLRADAR_CAPACITY_BASELINE', None)
            subprocess.run([sys.executable, str(ROOT / 'scripts/package-release.py'), '--format', 'partitioned'],
                           cwd=base, env=env, check=True, stdout=subprocess.DEVNULL)
            elapsed = monotonic() - started
            measured = json.loads((base / 'artifacts/site-capacity.json').read_bytes())
            with tempfile.TemporaryDirectory(prefix='activation-', dir=base) as release:
                checked = Path(release)
                packed = (base / 'artifacts/site.tar.gz').read_bytes()
                started = monotonic()
                DEPLOY['extract_static'](packed, checked, args.revision)
                extracted = monotonic() - started
                if (checked / DEPLOY['CORPUS']).read_bytes() != body:
                    raise ValueError('Round-trip changed the corpus')
                installed = sum(item.stat().st_size for item in checked.rglob('*') if item.is_file())
                print(json.dumps({
                    'facteur': factor, 'mesures': len(document['measures']), 'versions': len(document['versions']),
                    'limites': measured['limits'], 'corpus': measured['corpusTransport'], 'plus-grand': measured['largest'],
                    'octets-installes': installed, 'packaging-secondes': round(elapsed, 2),
                    'extraction-secondes': round(extracted, 2),
                }, ensure_ascii=False), flush=True)
                if args.mcp:
                    env.update(POLRADAR_GROWTH_SITE=release, POLRADAR_GROWTH_FACTOR=str(factor),
                               POLRADAR_GROWTH_MEASURES=str(len(original['measures'])),
                               POLRADAR_GROWTH_VERSIONS=str(len(original['versions'])), GOMEMLIMIT='136MiB')
                    subprocess.run(['go', 'test', '-count=1', '-run', '^TestLocalCorpusGrowth$', '-v', '.'],
                                   cwd=ROOT / 'mcp', env=env, check=True)


if __name__ == '__main__':
    main()
