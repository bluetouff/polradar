"""Exercise the last independently deployed service and site in both combinations."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import runpy
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS_SITE = 'abc3846fc6c17d7e894e6a0add20d0611c2328e6'
PREVIOUS_SERVICE = '867cd0601aa35c3dd18b62ef554cf76b2624b433'
DIGEST = '130f74d8822aeebaec79f0c5802df5bd09155531630537edfadb966dc0abbef0'
DEPLOY = runpy.run_path(str(ROOT/'deploy/pull-release.py'))


def previous_service(destination):
    names = subprocess.check_output(['git','ls-tree','-r','--name-only',PREVIOUS_SERVICE,'--','mcp'],
                                    cwd=ROOT,text=True).splitlines()
    for name in names:
        path = Path(name)
        if path.parent == Path('mcp/testdata') and path.suffix == '.json':
            target = destination/'testdata'/path.name
            target.parent.mkdir(exist_ok=True)
        elif path.parent == Path('mcp') and (path.suffix == '.go' or path.name in ('go.sum','go.mod')):
            target = destination/path.name
        else:
            continue
        target.write_bytes(subprocess.check_output(['git','show',PREVIOUS_SERVICE+':'+name],cwd=ROOT))
    align_documentary_expectations(destination)


def align_documentary_expectations(service):
    """Test the old client's questions against the facts of the edition it reads."""
    bank = service / 'testdata/questions-documentaires.json'
    previous = json.loads(bank.read_bytes())
    current = json.loads((ROOT / 'mcp/testdata/questions-documentaires.json').read_bytes())
    if previous['version'] != current['version']:
        raise ValueError('Contrat du banc documentaire incompatible')
    by_question = {entry['question']: entry for entry in current['questions']}
    questions = []
    for entry in previous['questions']:
        updated = by_question.get(entry['question'])
        if updated is None or any(entry.get(key) != updated.get(key)
                                  for key in ('outil', 'arguments', 'vide', 'erreur')):
            raise ValueError('Question historique absente ou modifiée : ' + entry['question'])
        questions.append(updated)
    bank.write_text(json.dumps({**previous, 'questions': questions}, ensure_ascii=False),
                    encoding='utf-8')


def run(site, service, sha):
    env = dict(os.environ, POLRADAR_TEST_SITE=str(site), POLRADAR_TEST_COMMIT=sha, GOWORK='off')
    subprocess.run(['go','test','-count=1','-run','^TestPublished','.'],cwd=service,env=env,check=True)


def verify_legacy_limit(site, service):
    fixture = ROOT / 'mcp/testdata/legacy_corpus_budget_test.go'
    (service / fixture.name).write_bytes(fixture.read_bytes())
    env = dict(os.environ, POLRADAR_TEST_SITE=str(site), GOWORK='off')
    subprocess.run(['go', 'test', '-count=1', '-run', '^TestLegacyCorpusBudget$', '.'],
                   cwd=service, env=env, check=True)


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
            old=DEPLOY['download']('https://github.com/bluetouff/polradar/releases/download/site-'+PREVIOUS_SITE+'/site.tar.gz',DEPLOY['MAX_ARCHIVE'])
        if hashlib.sha256(old).hexdigest()!=DIGEST: raise ValueError('Empreinte de la référence incorrecte')
        if args.archive.stat().st_size > DEPLOY['PARTITIONED_MAX_ARCHIVE']: raise ValueError('Archive courante trop grande')
        head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
        for name in ('ancien','nouveau','service'): (base/name).mkdir()
        DEPLOY['extract_static'](old,base/'ancien',PREVIOUS_SITE)
        DEPLOY['extract_static'](args.archive.read_bytes(),base/'nouveau',head)
        previous_service(base/'service')
        print('Service courant sur édition précédente',flush=True)
        run(base/'ancien',ROOT/'mcp',PREVIOUS_SITE)
        if (base/'nouveau'/DEPLOY['CORPUS']).stat().st_size <= DEPLOY['MAX_FILE']:
            print('Service précédent sur édition courante',flush=True)
            run(base/'nouveau',base/'service',head)
        else:
            print('Le service précédent refuse le corpus agrandi. La bascule exige le lecteur partitionné actif.',flush=True)
            verify_legacy_limit(base/'nouveau',base/'service')
        env=dict(os.environ,GOMEMLIMIT='136MiB',POLRADAR_PREVIOUS_SITE=str(base/'ancien'),POLRADAR_TEST_SITE=str(base/'nouveau'))
        subprocess.run(['go','test','-count=1','-v','-run','^TestLocalSnapshotFootprint$','.'],cwd=ROOT/'mcp',env=env,check=True)


if __name__ == '__main__': main()
