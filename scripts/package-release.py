"""Package only built static files; no checkout, dependencies or credentials."""
import hashlib
import pathlib
import tarfile

root = pathlib.Path('dist')
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
(target / 'site.sha256').write_text(f'{hashlib.sha256(archive.read_bytes()).hexdigest()}  site.tar.gz\n', encoding='ascii')
print('Static release packaged with SHA-256 checksum.')
