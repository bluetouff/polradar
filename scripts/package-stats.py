"""Package only reviewed, credential-free GoAccess code for operator installation."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile

FILES = ('generate.py', 'index.html', 'viewer.mjs', 'viewer.css', 'polradar-stats.service', 'polradar-stats.timer', 'install.py')


def package(root=Path('.')):
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True, cwd=root).strip()
    if not re.fullmatch(r'[a-f0-9]{40}', sha):
        raise ValueError('Invalid source revision')
    directory = root / 'deploy/goaccess'
    manifest = {'sourceCommit': sha, 'files': {name: hashlib.sha256((directory / name).read_bytes()).hexdigest() for name in FILES}}
    output = root / 'artifacts'; output.mkdir(exist_ok=True)
    archive = output / 'polradar-goaccess.tar.gz'
    with tempfile.TemporaryDirectory() as temporary:
        manifest_path = Path(temporary) / 'manifest.json'; manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
        with tarfile.open(archive, 'w:gz', format=tarfile.USTAR_FORMAT) as tar:
            def metadata(info):
                info.uid = info.gid = 0
                info.uname = info.gname = ''
                info.mode = 0o644
                return info
            for name in FILES:
                if (directory / name).is_symlink(): raise ValueError('Symlink in installation bundle')
                tar.add(directory / name, arcname=name, recursive=False, filter=metadata)
            tar.add(manifest_path, arcname='manifest.json', recursive=False, filter=metadata)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output / 'polradar-goaccess.sha256').write_text(f'{digest}  polradar-goaccess.tar.gz\n')
    print(f'GoAccess operator bundle: {sha}')


if __name__ == '__main__':
    package()
