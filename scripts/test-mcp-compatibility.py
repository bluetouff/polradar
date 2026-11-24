"""Exercise the last independently deployed service and site in both combinations."""
import argparse
import hashlib
import os
from pathlib import Path
import runpy
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = 'cdaae3bff0fd82a0676242b6123c8b93f0c47aa9'
DIGEST = 'd222b11c91073bab36653a685a2d4307c2be4f3307ab01c5a531d77c6edb4b4e'
DEPLOY = runpy.run_path(str(ROOT/'deploy/pull-release.py'))


def previous_service(destination):
    names = subprocess.check_output(['git','ls-tree','-r','--name-only',PREVIOUS,'--','mcp'],
                                    cwd=ROOT,text=True).splitlines()
    for name in names:
        path = Path(name)
        if path.parent != Path('mcp') or (path.suffix != '.go' and path.name not in ('go.sum','go.mod')):
            continue
        (destination/path.name).write_bytes(subprocess.check_output(['git','show',PREVIOUS+':'+name],cwd=ROOT))


def run(site, service, sha):
    env = dict(os.environ, POLRADAR_TEST_SITE=str(site), POLRADAR_TEST_COMMIT=sha, GOWORK='off')
    subprocess.run(['go','test','-count=1','-run','^TestPublished','.'],cwd=service,env=env,check=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('archive',type=Path)
    parser.add_argument('--previous',type=Path,help='copie locale de l’archive publique épinglée')
    args=parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='polradar-matrice-') as temporary:
        base=Path(temporary)
        if args.previous:
            if args.previous.stat().st_size > DEPLOY['MAX_ARCHIVE']: raise ValueError('Archive précédente trop grande')
            old=args.previous.read_bytes()
        else:
            old=DEPLOY['download']('https://github.com/bluetouff/polradar/releases/download/site-'+PREVIOUS+'/site.tar.gz',DEPLOY['MAX_ARCHIVE'])
        if hashlib.sha256(old).hexdigest()!=DIGEST: raise ValueError('Empreinte de la référence incorrecte')
        if args.archive.stat().st_size > DEPLOY['MAX_ARCHIVE']: raise ValueError('Archive courante trop grande')
        head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
        for name in ('ancien','nouveau','service'): (base/name).mkdir()
        DEPLOY['extract_static'](old,base/'ancien',PREVIOUS)
        DEPLOY['extract_static'](args.archive.read_bytes(),base/'nouveau',head)
        previous_service(base/'service')
        print('Service courant sur édition précédente',flush=True)
        run(base/'ancien',ROOT/'mcp',PREVIOUS)
        print('Service précédent sur édition courante',flush=True)
        run(base/'nouveau',base/'service',head)
        env=dict(os.environ,GOMEMLIMIT='136MiB',POLRADAR_PREVIOUS_SITE=str(base/'ancien'),POLRADAR_TEST_SITE=str(base/'nouveau'))
        subprocess.run(['go','test','-count=1','-v','-run','^TestLocalSnapshotFootprint$','.'],cwd=ROOT/'mcp',env=env,check=True)


if __name__ == '__main__': main()
