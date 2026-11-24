"""Compare a cold Astro build to a warm one in a disposable checkout."""
import argparse
from datetime import date, timedelta
import hashlib
import json
import re
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
CASES = ('identique','correction','ajout','suppression','candidature','source','budget','edition','migration','partage')

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
        elif key.endswith('.xml') and b'<rss version="2.0">' in raw:
            # rss.ts timestamps feed generation at wall-clock time; preserve all item dates.
            raw, count = re.subn(rb'<lastBuildDate>[^<]+</lastBuildDate>',b'<lastBuildDate/>',raw)
            if count != 1: raise ValueError(f'{key}: date de génération RSS inattendue')
        index[key] = hashlib.sha256(raw).hexdigest()
    return index

def mutate(cwd, case):
    data = cwd/'src/data'
    def read(name):
        return json.loads((data/(name+'.json')).read_bytes())
    def write(name,value):
        (data/(name+'.json')).write_text(json.dumps(value, ensure_ascii=False))
    if case in ('correction','ajout'):
        measures, versions = read('measures'),read('versions')
        # A one-version copy used only inside the disposable clone.
        item = next(m for m in measures if m['id']=='herlin-semaine-40-heures')
        if case=='correction':
            item['description'] += ' (Recette locale.)'
            next(v for v in versions if v['measureId']==item['id'] and v['number']==item['revision'])['snapshot']['description']=item['description']
        else:
            original=next(v for v in versions if v['measureId']==item['id'] and v['number']==item['revision'])
            identifier='recette-page-temporaire'
            title=item['title']+' (recette locale)'
            measures.append({**item,'id':identifier,'revision':1,'title':title})
            versions.append({**original,'id':identifier+'-v1','measureId':identifier,'number':1,'snapshot':{**original['snapshot'],'title':title}})
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
        meta=read('meta');meta['edition']=meta['corpusUpdated']=(date.fromisoformat(meta['corpusUpdated'])-timedelta(days=1)).isoformat();write('meta',meta)
    elif case=='migration':
        migration=read('poll-graphic-migration')
        alias='a'*64
        if alias in migration: raise ValueError('Collision avec une série existante')
        migration[alias]=next(iter(migration.values())).copy()
        write('poll-graphic-migration',migration)
    elif case=='partage':
        file=cwd/'src/lib/social-image-view.mjs'
        original=file.read_text()
        changed=original.replace('Assemblée nationale · scrutin n°', 'Assemblée nationale · vote n°')
        if changed==original: raise ValueError('Gabarit des votes introuvable')
        file.write_text(changed)

def run(cases):
    rev=command(ROOT,'git','rev-parse','HEAD').strip()
    with tempfile.TemporaryDirectory(prefix='polradar-rendus-') as directory:
        cwd=Path(directory)/'site'
        command(ROOT,'git','clone','--quiet','--local','--no-hardlinks',str(ROOT),str(cwd))
        command(cwd,'git','checkout','--quiet','--detach',rev)
        (cwd/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
        shutil.copytree(ROOT/'public/og',cwd/'public/og',dirs_exist_ok=True)
        def social(cold=False):
            if cold: shutil.rmtree(cwd/'.cache/polradar-og',ignore_errors=True)
            command(cwd,'node','scripts/render-social-images.mjs')

        def build(cold=False):
            start=time.monotonic()
            args=['node','scripts/build-pages.mjs']
            if cold: args.append('--full')
            with (Path(directory)/'log').open('w+') as log:
                try: command(cwd,*args,log=log)
                except subprocess.CalledProcessError:
                    log.seek(0);print(''.join(log.readlines()[-65:]),flush=True);raise
                log.seek(0); last=log.readlines()[-1].strip()
            return round(time.monotonic()-start,2),last
        build(True)
        for case in cases:
            command(cwd,'git','restore','--source',rev,'--','src')
            if case=='suppression':
                mutate(cwd,'ajout')
                build()
                command(cwd,'git','restore','--source',rev,'--','src')
            mutate(cwd,case)
            if case=='partage':
                social()
                original_images={p.name:p.read_bytes() for p in (ROOT/'public/og').glob('*.png')}
                changed=[p.name for p in (cwd/'public/og').glob('*.png') if p.name in original_images and original_images[p.name]!=p.read_bytes()]
                if 'votes.png' not in changed: raise ValueError('Aperçu des votes inchangé')
                for legacy in (cwd/'src/assets/social/anciens').glob('*.png'):
                    if (cwd/'public/og'/legacy.name).read_bytes()!=legacy.read_bytes(): raise ValueError('Lien OG historique cassé')
            warm,stats=build()
            expected=fingerprint(cwd)
            if case=='migration' and not any('a'*64 in name for name in expected):
                raise ValueError('La migration de recette doit produire le graphique de l’ancienne adresse')
            if case=='partage': social(True)
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

