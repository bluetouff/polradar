"""Build an explicit, credential-free operator bundle. No data or configs from the host."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile

MCP = ('apache.conf', 'polradar-mcp.service', 'polradar-mcp.socket')
GSC = ('gsc_collect.py', 'gsc_view.py', 'polradar-gsc.service', 'polradar-gsc.timer', 'index.html', 'viewer.css', 'viewer.mjs')
ROOT = Path(__file__).resolve().parents[2]


def source_commit():
    sha = subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip()
    if not re.fullmatch('[a-f0-9]{40}', sha):
        raise ValueError('Invalid source commit')
    return sha


def launcher(out):
    script = Path(__file__).with_name('activer.sh').read_text()
    assets = {'gsc': 'polradar-gsc', 'amd64': 'polradar-mcp-linux-amd64', 'arm64': 'polradar-mcp-linux-arm64'}
    values = {'commit': source_commit()}
    for name, asset in assets.items():
        values[name] = hashlib.sha256((out / (asset + '.tar.gz')).read_bytes()).hexdigest()
    for name, value in values.items():
        marker = f"release_{name}=''"
        if script.count(marker) != 1:
            raise ValueError('Invalid launcher template')
        script = script.replace(marker, f"release_{name}='{value}'")
    target = out / 'polradar-activer.sh'
    target.write_bytes(script.encode('utf-8'))
    (out / 'polradar-activer.sha256').write_text(hashlib.sha256(target.read_bytes()).hexdigest() + '  ' + target.name + '\n')


def package(kind, out, binary=None, arch=None):
    sha = source_commit()
    files = {'install.py': Path(__file__).with_name('install.py'), 'LICENSE': ROOT / 'LICENSE'}
    if kind == 'mcp':
        if arch not in ('amd64', 'arm64') or not binary:
            raise ValueError('A Linux MCP executable is required')
        files.update({n: ROOT / 'mcp/deploy' / n for n in MCP})
        files['polradar-mcp'] = binary
        archive_name = 'polradar-mcp-linux-' + arch
    else:
        files.update({n: ROOT / 'deploy/goaccess' / n for n in GSC})
        archive_name = 'polradar-gsc'
    if any(not p.is_file() or p.is_symlink() for p in files.values()):
        raise ValueError('Unsafe bundle input')
    contents = {k: p.read_bytes() for k, p in files.items()}
    manifest = dict(component=kind, arch=arch, sourceCommit=sha, files={k:hashlib.sha256(v).hexdigest() for k,v in contents.items()})
    contents['manifest.json'] = json.dumps(manifest,indent=2,sort_keys=True).encode() + b'\n'
    out.mkdir(parents=True, exist_ok=True)
    archive = out / (archive_name + '.tar.gz')
    with archive.open('wb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as gz, tarfile.open(fileobj=gz,mode='w|',format=tarfile.USTAR_FORMAT) as tar:
        for name, data in sorted(contents.items()):
            member = tarfile.TarInfo(name)
            member.mode = 0o644
            member.size = len(data)
            tar.addfile(member,io.BytesIO(data))
    (out / (archive_name + '.sha256')).write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('component', choices=('mcp','gsc','launcher'))
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--binary', type=Path)
    parser.add_argument('--arch',choices=('amd64','arm64'))
    args = parser.parse_args()
    if args.component == 'launcher':
        launcher(args.out)
    else:
        package(args.component,args.out,args.binary,args.arch)
