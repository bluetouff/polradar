"""Package only built static files; no checkout, dependencies or credentials."""
import hashlib
import io
import json
import os
import pathlib
import re
import tarfile
import tempfile
from release_capacity import DEPLOY as deployment, measure, report

root = pathlib.Path('dist')
verification_file = os.environ.get('GSC_VERIFICATION_FILE', '')
if verification_file:
    if not re.fullmatch(r'google[0-9a-f]{16}\.html', verification_file):
        raise ValueError('Invalid Search Console verification filename')
    if (root / verification_file).exists():
        raise ValueError('Search Console verification filename already in build')
target = pathlib.Path('artifacts')
target.mkdir(exist_ok=True)
archive = target / 'site.tar.gz'
with tarfile.open(archive, 'w:gz', format=tarfile.USTAR_FORMAT) as bundle:
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            raise ValueError('Symbolic link in build')
        if path.is_file():
            info = bundle.gettarinfo(str(path), arcname=path.relative_to(root).as_posix())
            info.uid = info.gid = 0
            info.uname = info.gname = ''
            info.mode = 0o644
            with path.open('rb') as source:
                bundle.addfile(info, source)
    if verification_file:
        body = ('google-site-verification: ' + verification_file).encode('ascii')
        entry = tarfile.TarInfo(verification_file)
        entry.size = len(body)
        entry.mode = 0o644
        bundle.addfile(entry, io.BytesIO(body))
if archive.stat().st_size > deployment['MAX_ARCHIVE']:
    raise ValueError('Compressed static archive too large')
raw = archive.read_bytes()
manifest = json.loads((root / 'build.json').read_text(encoding='utf-8'))
expected_sha = os.environ.get('GITHUB_SHA') or manifest['sourceCommit']
with tempfile.TemporaryDirectory(prefix='polradar-package-') as checked:
    deployment['extract_static'](raw, pathlib.Path(checked), expected_sha)
(target / 'site.sha256').write_text(f'{hashlib.sha256(raw).hexdigest()}  site.tar.gz\n', encoding='ascii')
capacity = measure(raw)
for label, used, limit in capacity[0]:
    if limit - used < limit / 10:
        print(f'::warning::{label}: marge de déploiement inférieure à 10 %.')
summary_text = report(capacity)
print(summary_text)
if summary := os.environ.get('GITHUB_STEP_SUMMARY'):
    with open(summary, 'a', encoding='utf-8') as output:
        output.write('\n' + summary_text)
print('Static release packaged with SHA-256 checksum.')
