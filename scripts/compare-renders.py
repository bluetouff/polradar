"""Compare a cold Astro build to a warm one in a disposable checkout."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
CASES = ('identique','correction','retrait-ajout','candidature','source','budget','edition','partage')

def command(cwd, *args, log=None):
    return subprocess.run(args, cwd=cwd, check=True, text=True,
                          stdout=log or subprocess.PIPE, stderr=subprocess.STDOUT).stdout

def fingerprint(cwd):
    index = {}
    for p in sorted((cwd/'dist').rglob('*')):
        if not p.is_file():
            continue
        key = p.relative_to(cwd/'dist').as_posix()
        raw = p.read_bytes()
        if key == 'build.json':
            marker = json.loads(raw)
            del marker['builtAt']
            raw = json.dumps(marker,sort_keys=True).encode()
        index[key] = hashlib.sha256(raw).hexdigest()
    return index

def mutate(cwd, case):
    data = cwd/'src/data'
    def read(name):
        return json.loads((data/(name+'.json')).read_bytes())
    def write(name,value):
        (data/(name+'.json')).write_text(json.dumps(value, ensure_ascii=False))
    if case in ('correction','retrait-ajout'):
        measures, versions = read('measures'),read('versions')
        # A single-version leaf from the public corpus; removed only in the disposable clone.
        item = next(m for m in measures if m['id']=='herlin-semaine-40-heures')
        if case=='correction':
            item['description'] += ' (Recette locale.)'
            next(v for v in versions if v['measureId']==item['id'] and v['number']==item['revision'])['snapshot']['description']=item['description']
        else:
            measures.remove(item)
            versions=[v for v in versions if v['measureId']!=item['id']]
        write('measures',measures);write('versions',versions)
    elif case=='candidature':
        people=read('candidates')
        person=next(p for p in people if p.get('withdrawnOn'))
        del person['withdrawnOn']
        write('candidates',people)
    elif case=='source':
        refs=read('sources');refs[0]['title']+=' (Recette locale.)';write('sources',refs)
    elif case=='budget':
        budget=read('programme-budgets')
        target=next(t for p in budget['profiles'] for e in p['entries'] for t in e.get('review',{}).get('targets',[]))
        target['locator']+=' (Recette locale.)';write('programme-budgets',budget)
    elif case=='edition':
        meta=read('meta');meta['edition']='2026-11-25';write('meta',meta)
    elif case=='partage':
        file=cwd/'src/lib/social-images.mjs'
        file.write_text(file.read_text()+'\n// Recette du changement de gabarit OG.\n')

def run(cases):
    rev=command(ROOT,'git','rev-parse','HEAD').strip()
    with tempfile.TemporaryDirectory(prefix='polradar-rendus-') as directory:
        cwd=Path(directory)/'site'
        command(ROOT,'git','clone','--quiet','--local','--no-hardlinks',str(ROOT),str(cwd))
        command(cwd,'git','checkout','--quiet','--detach',rev)
        (cwd/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
        shutil.copytree(ROOT/'public/og',cwd/'public/og',dirs_exist_ok=True)
        def build(cold=False):
            start=time.monotonic()
            args=['node','scripts/build-pages.mjs']
            if cold: args.append('--full')
            with (Path(directory)/'log').open('w+') as log:
                try: command(cwd,*args,log=log)
                except subprocess.CalledProcessError:
                    log.seek(0);print(''.join(log.readlines()[-24:]),flush=True);raise
                log.seek(0); last=log.readlines()[-1].strip()
            return round(time.monotonic()-start,2),last
        build(True)
        for case in cases:
            command(cwd,'git','restore','--source',rev,'--','src')
            mutate(cwd,case)
            warm,stats=build()
            expected=fingerprint(cwd)
            cold,_=build(True)
            actual=fingerprint(cwd)
            differences=sorted(k for k in set(expected)|set(actual) if expected.get(k)!=actual.get(k))
            if differences: raise ValueError(f'{case}: {len(differences)} divergences, {differences[:8]}')
            print(f'{case}: {len(actual)} fichiers identiques, incrémental {warm}s, complet {cold}s. {stats}',flush=True)
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('cases',nargs='*')
    args=parser.parse_args()
    if set(args.cases)-set(CASES): parser.error('Scénario inconnu')
    run(args.cases or CASES)

