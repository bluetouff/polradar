#!/usr/bin/env python3
"""Rebuild the historical roll-call register from the Assembly's pinned public archives."""
import argparse
from bisect import bisect_left, bisect_right
from collections import Counter
from contextlib import contextmanager
from datetime import date
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import tempfile
import unicodedata
from urllib.request import HTTPRedirectHandler, Request, build_opener
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'src/data/parlement/assemblee.json'
BASE = 'https://data.assemblee-nationale.fr/static/openData/repository/'
LICENCE = 'https://data.assemblee-nationale.fr/licence-ouverte-open-licence'
VOTES = 'loi/scrutins/Scrutins'
ACTORS = 'amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes'
SOURCES = {
    15: {
        'scrutins': (VOTES+'_XV.json.zip','ca00f314b6957c9b0f32951a79d393f35a6cfd9f09626a11730984c94985084b'),
        'acteurs': (ACTORS+'_XV.json.zip','535518e7b9b6de971b1937271f0fa70609c7e5dac6caa3aae3657af9536ba9f5'),
    },
    16: {
        'scrutins': (VOTES+'.json.zip','adc5e57d3ad5904fd11e176b531b3d525d4ecfdf78db9587f93a14452601126b'),
        'acteurs': (ACTORS+'.json.zip','522685d86886d8b54a75beee29b4891a4e5655f6d4871f44c59d70a7f28e759c'),
    },
    17: {
        'scrutins': (VOTES+'.json.zip','076a49b680aad04b68bce67c7ba40d5152d5fe3a22b50275ff63c532ff8b19bf'),
        'acteurs': (ACTORS+'.json.zip','64bfa9b55ab5605f2d5c653bf5336df3e278f28a29df99814eb99a79c5e2bd8b'),
    },
}
# Exact expanded source size from the reviewed November edition. Each member
# is verified and read independently; no third-party archive is extracted.
XVII_SOURCE_BYTES = 203731131
CHOICES = {
    'pour':'pour','pours':'pour','contre':'contre','contres':'contre',
    'abstention':'abstention','abstentions':'abstention','nonVotants':'non-votant',
    'nonVotantsVolontaires':'non-votant-volontaire',
}
LIMIT_DOWNLOAD = 32 << 20
LIMIT_ARCHIVE = 128 << 20
LIMIT_MEMBER = 512 << 10


def check(ok, message):
    if not ok:
        raise ValueError(message)


def many(value):
    return value if isinstance(value, list) else ([] if value is None else [value])


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise ValueError('Redirection du fichier source refusée')


@contextmanager
def archive(cache, term, kind, fetch):
    part, expected = SOURCES[term][kind]
    src = cache / f'{term}-{kind}.zip'
    if not src.exists() and fetch:
        url = BASE + f'{term}/' + part
        req = Request(url, headers={'User-Agent':'Polradar/archives-parlementaires'})
        with build_opener(NoRedirect()).open(req, timeout=45) as resp, tempfile.NamedTemporaryFile(dir=cache) as tmp:
            size = 0
            while chunk := resp.read(65536):
                size += len(chunk)
                check(size <= LIMIT_DOWNLOAD, 'Téléchargement trop volumineux')
                tmp.write(chunk)
            tmp.flush()
            tmp.seek(0)
            check(sha256(tmp.read(LIMIT_DOWNLOAD+1)).hexdigest() == expected, 'Empreinte officielle changée')
            tmp.seek(0)
            # Link only a complete and checked download into the persistent cache.
            os.link(tmp.name, src)
    with src.open('rb') as f:
        check(os.fstat(f.fileno()).st_size <= LIMIT_DOWNLOAD, 'Archive trop volumineuse')
        check(sha256(f.read(LIMIT_DOWNLOAD+1)).hexdigest() == expected, 'Archive différente de la version relue')
        with ZipFile(f) as z:
            files = z.infolist()
            max_size = XVII_SOURCE_BYTES if (term, kind) == (17, 'scrutins') else LIMIT_ARCHIVE
            check(0 < len(files) <= 12000 and sum(i.file_size for i in files) <= max_size, 'Limite ZIP dépassée')
            check(len(set(z.namelist())) == len(files), 'Fichier ZIP en double')
            for i in files:
                check(i.file_size <= LIMIT_MEMBER and not i.flag_bits & 1 and
                      re.fullmatch(r'json/(?:acteur/PA\d+|organe/PO\d+|VT(?:AN|CG)R\d+L\d+V\d+)\.json', i.filename),
                      'Membre ZIP inattendu')
            yield z


def official_people():
    curated = json.loads((ROOT/'src/data/legislative-votes.json').read_bytes())
    names = {c['id']:c['name'] for c in json.loads((ROOT/'src/data/candidates.json').read_bytes())}
    result = {}
    for b in curated['ballots']:
        if b['chamber'] != 'assemblee':
            continue
        for p in b['positions']:
            actor = p['officialId']
            if actor is None:
                continue
            check(re.fullmatch(r'PA\d+', actor) and p['profileUrl'].endswith('/'+actor),
                  'Identité AN sans référence institutionnelle')
            identity = (p['candidate'],names[p['candidate']])
            check(result.setdefault(actor, identity) == identity, 'Identité attribuée à deux personnes')
    return result


def normalized(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text.casefold()) if c.isalnum())


def roster(z, term):
    known, mandates, groups = {}, {}, {}
    files = set(z.namelist())
    for actor_id,(candidate,name) in official_people().items():
        member = 'json/acteur/'+actor_id+'.json'
        if member not in files:
            continue
        person = json.loads(z.read(member))['acteur']
        ident = person['etatCivil']['ident']
        check(person['uid']['#text'] == actor_id and normalized(ident['prenom']+' '+ident['nom']) == normalized(name),
              'Désaccord entre l’identité retenue et celle de l’Assemblée')
        for mandate in many(person['mandats']['mandat']):
            if mandate['typeOrgane'] == 'ASSEMBLEE' and mandate.get('legislature') == str(term):
                check(mandate['acteurRef'] == actor_id and re.fullmatch(r'PM\d+', mandate['uid']), 'Mandat étranger')
                known[actor_id] = candidate
                mandates[mandate['uid']] = {'acteur':actor_id,'debut':mandate['dateDebut'],'fin':mandate['dateFin']}
    for file in sorted(files):
        if not file.startswith('json/organe/'):
            continue
        org = json.loads(z.read(file))['organe']
        if org['codeType'] == 'GP':
            groups[org['uid']] = {'nom':org['libelle'],'sigle':org['libelleAbrev']}
    return known, mandates, groups


def positions(node, kind=None):
    for key, value in (node or {}).items():
        if key == 'dysfonctionnement':
            yield from positions(value, 'dysfonctionnement')
            continue
        if not value:
            continue
        check(key in CHOICES, 'Modalité de vote inconnue')
        for block in many(value):
            if block is not None:
                for v in many(block['votant']):
                    yield CHOICES[key], v, kind


def integer(value):
    check(isinstance(value,str) and re.fullmatch(r'\d{1,4}',value), 'Décompte invalide')
    return int(value)


def ballot(b, term, known, mandates, groups):
    check(isinstance(b['numero'], str) and re.fullmatch(r'[1-9]\d{0,5}', b['numero']), 'Numéro de scrutin invalide')
    number = int(b['numero'])
    uid, day = b['uid'], b['dateScrutin']
    check(b['legislature'] == str(term) and uid == f'VTANR5L{term}V{number}' and
          b['modePublicationDesVotes'] == 'DecompteNominatif', 'Identifiant ou décompte nominatif inattendu')
    date.fromisoformat(day)
    s=b['syntheseVote']
    t=s['decompte']
    yes,no,abst = (integer(t[key]) for key in ('pour','contre','abstentions'))
    expressed,total,required = (integer(s[key]) for key in ('suffragesExprimes','nombreVotants','nbrSuffragesRequis'))
    check(yes+no == expressed and expressed+abst == total, uid+' : totaux incompatibles')
    decision=b['sort']['code']
    check(decision in ('adopté','rejeté') and (yes >= required)==(decision=='adopté'), uid+' : décision incompatible')
    motion = b['typeVote']['codeTypeVote']=='MOC'
    if motion:
        check(no == abst == 0, 'Motion de censure avec suffrages non favorables')
    by_actor={}
    def identify(v):
        actor=v['acteurRef']
        if actor not in known:
            return None
        mandate=mandates.get(v['mandatRef'])
        check(mandate and mandate['acteur']==actor and mandate['debut']<=day and
              (mandate['fin'] is None or day<=mandate['fin']), uid+' : mandat non vérifié')
        return by_actor.setdefault(actor,{'candidat':known[actor],'mandat':v['mandatRef'],'vote':None,
                                         'groupe':None,'delegation':None,'misesAuPoint':[]})
    for group in many(b['ventilationVotes']['organe']['groupes']['groupe']):
        for choice,v,_ in positions(group['vote'].get('decompteNominatif')):
            p=identify(v)
            if p is None:
                continue
            check(p['vote'] is None, uid+' : double émargement')
            group_id=group['organeRef']
            if term == 17 and group_id == 'PO0':
                # Some official files repeat the sentinel PO0 for different groups.
                # It identifies no group in the official directory.
                p['organeSource']=group_id
                group_id=None
            else:
                check(group_id in groups, uid+' : groupe inconnu')
            delegated=v.get('parDelegation')
            check(delegated in (None,'true','false'), uid+' : délégation inconnue')
            p.update(vote=choice,groupe=group_id,delegation=None if delegated is None else delegated=='true')
    for choice,v,kind in positions(b.get('miseAuPoint'),'mise-au-point'):
        p=identify(v)
        if p is not None:
            point={'vote':choice,'nature':kind}
            if point not in p['misesAuPoint']:
                p['misesAuPoint'].append(point)
    if not by_actor:
        return None
    return {'id':uid,'legislature':term,'numero':number,'date':day,'objet':b['titre'],
            'type':b['typeVote']['libelleTypeVote'],'decision':decision,'censure':motion,
            'totaux':{'votants':total,'exprimes':expressed,'majorite':required,'pour':yes,
                      'contre':None if motion else no,'abstention':None if motion else abst},
            'source':f'https://www.assemblee-nationale.fr/dyn/{term}/scrutins/{number}',
            'positions':[by_actor[a] for a in sorted(by_actor)]}


def include_ballot(term, b, editorial_ids):
    return (term != 17 or b['dateScrutin'] >= '2026-01-01' or
            b['typeVote']['codeTypeVote'] in ('SPS','MOC') or b['uid'] in editorial_ids)


def collect(cache, fetch=False):
    editorial = json.loads((ROOT/'src/data/legislative-votes.json').read_bytes())
    editorial_ids = {f"VTANR5L17V{b['number']}" for b in editorial['ballots']
                     if b['chamber'] == 'assemblee' and b['term'] == '17e législature'}
    sources, actors, mandates, groups, rows, supplement = [], {}, {}, {}, [], []
    seen=set()
    for term, archives in SOURCES.items():
        with archive(cache,term,'acteurs',fetch) as a:
            selected, offices, parties=roster(a,term)
        for actor,candidate in selected.items():
            actors[candidate]={'id':actor,'source':'https://www.assemblee-nationale.fr/dyn/deputes/'+actor}
        mandates.update(offices)
        with archive(cache,term,'scrutins',fetch) as z:
            excluded=0
            selected_count=0
            days=[]
            for item in sorted(z.namelist()):
                b=json.loads(z.read(item))['scrutin']
                check(item=='json/'+b['uid']+'.json' and b['uid'] not in seen,'ID de scrutin répété')
                seen.add(b['uid'])
                if b.get('lieuVote')=='Congrès':
                    excluded+=1
                    continue
                days.append(date.fromisoformat(b['dateScrutin']).isoformat())
                detailed = include_ballot(term,b,editorial_ids)
                selected_count += int(detailed)
                row=ballot(b,term,selected,offices,parties)
                if row:
                    (rows if detailed else supplement).append(row)
                    for p in row['positions']:
                        if p['groupe']:
                            groups[p['groupe']]=parties[p['groupe']]
            days.sort()
            for mandate in offices.values():
                start = bisect_left(days, mandate['debut'])
                end = bisect_right(days, mandate['fin']) if mandate['fin'] else len(days)
                mandate.update(legislature=term, scrutinsExamines=max(0, end-start))
            years = Counter(day[:4] for day in days)
            sources.append({'legislature':term,'scrutinsExamines':len(days),'congresExclus':excluded,
                'scrutinsParAnnee': dict(years), 'debut':days[0], 'fin':days[-1],
                **({'scrutinsDansArchive':len(z.namelist()),'examinesDansEditionDetaillee':selected_count,'selectionDetaillee':'Tous les scrutins depuis le 1er janvier 2026, les scrutins solennels, les motions de censure et les scrutins déjà documentés dans un dossier Polradar depuis le début de la législature.'} if term == 17 else {}),
                'archives':{key:{'url':BASE+str(term)+'/'+location,'sha256':digest} for key,(location,digest) in archives.items()}})
    return {'version':1,'institution':'Assemblée nationale','licenceSource':LICENCE,'consultation':'2026-11-24',
            'sources':sources,'personnes':dict(sorted(actors.items())),'mandats':dict(sorted(mandates.items())),
            'groupes':dict(sorted(groups.items())),'complementXVII':sorted(supplement,key=lambda r:(r['date'],r['numero']),reverse=True),'scrutins':sorted(rows,key=lambda r:(r['date'],r['numero']),reverse=True)}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cache',type=Path,help='dossier local des archives vérifiées')
    parser.add_argument('--telecharger',action='store_true',help='télécharger uniquement les archives officielles manquantes')
    parser.add_argument('--verifier',action='store_true',help='comparer le résultat aux données déjà versionnées')
    args=parser.parse_args()
    args.cache.mkdir(parents=True,exist_ok=True)
    data=collect(args.cache,args.telecharger)
    encode=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'))
    # One ballot per line keeps historical changes reviewable in Git.
    rows=data.pop('scrutins')
    supplement=data.pop('complementXVII')
    prefix=encode(data)[:-1]+',"complementXVII":[\n'+',\n'.join(encode(r) for r in supplement)+'\n]'
    payload=(prefix+',"scrutins":[\n'+',\n'.join(encode(r) for r in rows)+'\n]}\n').encode()
    if args.verifier:
        check(DEST.read_bytes()==payload,'Registre différent du résultat de l’import')
    else:
        with tempfile.NamedTemporaryFile(dir=DEST.parent,delete=False) as tmp:
            tmp.write(payload)
        os.replace(tmp.name,DEST)
    print(f"{len(supplement)} scrutins XVIIe supplémentaires dans la recherche. {len(rows)} scrutins dans l’édition détaillée et {sum(p['vote'] is not None for r in rows for p in r['positions'])} positions nominatives. SHA-256 {sha256(payload).hexdigest()}")

if __name__=='__main__':
    main()
