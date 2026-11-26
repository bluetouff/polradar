"""Package only built static files; no checkout, dependencies or credentials."""
import argparse
import gzip
import hashlib
import io
import json
import os
import pathlib
import re
import tarfile
import tempfile
from corpus_transport import prepare
from release_capacity import DEPLOY as deployment, capacity_data, growth, measure, report


def add_generated(bundle, name, contents):
    entry = tarfile.TarInfo(name)
    entry.size = len(contents)
    entry.mode = 0o644
    bundle.addfile(entry, io.BytesIO(contents))


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--format', choices=('legacy', 'partitioned'), default='legacy')
args = parser.parse_args()
root = pathlib.Path('dist')
verification_file = os.environ.get('GSC_VERIFICATION_FILE', '')
if verification_file:
    if not re.fullmatch(r'google[0-9a-f]{16}\.html', verification_file):
        raise ValueError('Invalid Search Console verification filename')
    if (root / verification_file).exists():
        raise ValueError('Search Console verification filename already in build')
target = pathlib.Path('artifacts')
target.mkdir(exist_ok=True)
manifest = json.loads((root / 'build.json').read_text(encoding='utf-8'))
expected_sha = os.environ.get('GITHUB_SHA') or manifest['sourceCommit']
files = []
for path in sorted(root.rglob('*')):
    if path.is_symlink():
        raise ValueError('Symbolic link in build')
    if path.is_file():
        name = path.relative_to(root).as_posix()
        if name == deployment['CORPUS_PARTS_MANIFEST'] or name.startswith(deployment['CORPUS_PARTS_PREFIX']):
            raise ValueError('Reserved corpus transport path in build')
        files.append((name, path))
members = {}
partitioned = None
if args.format == 'partitioned':
    path = root / deployment['CORPUS']
    hashes = deployment['surface_hashes'](manifest)
    members, partitioned = prepare(path, expected_sha, hashes.get(deployment['CORPUS']))
    files = [(name, path) for name, path in files if name != deployment['CORPUS']]
if verification_file:
    members[verification_file] = ('google-site-verification: ' + verification_file).encode('ascii')

profile = deployment['archive_budget'](partitioned is not None)
archive = target / 'site.tar.gz'
with tempfile.NamedTemporaryFile(dir=target) as pending:
    with (
        gzip.GzipFile(filename='', fileobj=pending, mode='wb', mtime=0) as compressed,
        tarfile.open(fileobj=compressed, mode='w', format=tarfile.USTAR_FORMAT) as bundle,
    ):
        if partitioned is not None:
            marker = deployment['CORPUS_PARTS_MANIFEST']
            add_generated(bundle, marker, members.pop(marker))
        for name, path in files:
            info = bundle.gettarinfo(str(path), arcname=name)
            info.uid = info.gid = 0
            info.uname = info.gname = ''
            info.mode = 0o644
            info.mtime = 0
            with path.open('rb') as source:
                bundle.addfile(info, source)
        for name, contents in sorted(members.items()):
            add_generated(bundle, name, contents)
    pending.seek(0)
    raw = pending.read(profile.compressed + 1)
with tempfile.TemporaryDirectory(prefix='polradar-package-') as checked:
    deployment['extract_static'](raw, pathlib.Path(checked), expected_sha)
capacity = measure(raw, expected_sha)
budgets = list(capacity[0])
if partitioned:
    budgets.append(('Corpus reconstitué (octets)', partitioned['bytes'], deployment['MAX_CORPUS']))
for label, used, limit in budgets:
    ratio = used / limit
    if used >= limit:
        raise ValueError(f'{label}: plafond de publication atteint ({ratio:.1%}).')
    if ratio >= .95:
        print(f'::warning::{label}: risque critique, {ratio:.1%} du plafond de publication.')
    elif ratio >= .85:
        print(f'::warning::{label}: action préventive, {ratio:.1%} du plafond de publication.')
    elif ratio >= .70:
        print(f'::notice::{label}: surveillance, {ratio:.1%} du plafond de publication.')
data = capacity_data(capacity, expected_sha)
summary_text = report(capacity) + '\n' + growth(data, os.environ.get('POLRADAR_CAPACITY_BASELINE'))
if partitioned:
    data['corpusTransport'] = {
        'version': 1, 'bytes': partitioned['bytes'],
        'limit': deployment['MAX_CORPUS'],
        'parts': len(partitioned['partitions']),
        'partLimit': deployment['MAX_CORPUS_PART'],
        'maxParts': deployment['MAX_CORPUS_PARTS'],
    }
    summary_text += (
        f"\nCorpus reconstitué : {partitioned['bytes']:,} octets, "
        f"{len(partitioned['partitions'])} partitions vérifiées.\n"
    )
archive.write_bytes(raw)
(target / 'site.sha256').write_text(f'{hashlib.sha256(raw).hexdigest()}  site.tar.gz\n', encoding='ascii')
(target / 'site-capacity.json').write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
print(summary_text)
if summary := os.environ.get('GITHUB_STEP_SUMMARY'):
    with open(summary, 'a', encoding='utf-8') as output:
        output.write('\n' + summary_text)
print('Static release packaged with SHA-256 checksum.')
