#!/usr/bin/env python3
"""Produce a reviewed Senate / European Parliament selection from public institutional files."""
import argparse
import csv
import json
import os
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, build_opener
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT/'src/data/parlement/senat-europe.json'
SENATE = 'https://data.senat.fr/data/'
EP = 'https://data.europarl.europa.eu/'
MEETINGS = ('2024-03-12','2024-03-13','2024-03-14','2024-11-14','2024-12-19')
SESSIONS = {'2006','2022','2023'}
INPUTS = {
 'dosleg.zip': SENATE+'dosleg/dosleg.zip',
 'sen-mandats.csv': SENATE+'senateurs/ODSEN_ELUSEN.csv',
 'sen-groupes.csv': SENATE+'senateurs/ODSEN_HISTOGROUPES.csv',
 'ep-history.json': EP+'api/v2/meps/197694?format=application%2Fld%2Bjson',
 **{'ep-'+d+'.json': EP+'api/v2/meetings/MTG-PL-'+d+'/decisions?format=application%2Fld%2Bjson' for d in MEETINGS},
}
PEOPLE = {
 '04033B': ('retailleau','Bruno','Retailleau','https://www.senat.fr/senateur/retailleau_bruno04033b.html'),
 '86039K': ('melenchon','Jean-Luc','Mélenchon','https://www.senat.fr/senateur/melenchon_jean_luc86039k.html'),
}
def require(ok, message):
    if not ok: raise ValueError(message)
def atomic(path,content):
    with NamedTemporaryFile(dir=path.parent,delete=False) as f:
        f.write(content)
        temporary = Path(f.name)
    try: os.replace(temporary,path)
    finally: temporary.unlink(missing_ok=True)
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args): raise ValueError('Redirection non prévue')
def prepare(cache,fetch,inputs=INPUTS):
    cache.mkdir(exist_ok=True,parents=True)
    for name,url in inputs.items():
        path=cache/name
        if fetch and not path.exists():
            with build_opener(NoRedirect()).open(url,timeout=40) as reply:
                content=reply.read(32*1024*1024+1)
            require(0<len(content)<=32*1024*1024,'Taille du téléchargement inattendue')
            atomic(path,content)
        require(path.is_file() and not path.is_symlink() and 0<path.stat().st_size<=32*1024*1024,'Fichier manquant ou non ordinaire : '+name)
def indates(day,start,end):
    return bool(start and start[:10]<=day and (not end or day<=end[:10]))
def csvrows(path):
    with path.open(encoding='cp1252',newline='') as f:
        yield from csv.DictReader(line for line in f if not line.startswith('%'))
def senate_text(value):
    # COPY escapes and CP1252 punctuation in the Senate’s historical UTF-8 columns.
    return ' '.join(value.translate({0x92:'’',0x96:'–',0x9c:'œ'}).replace(r'\n',' ').replace(r'\r',' ').replace(r'\t',' ').split())

def senate_url(url):
    parsed=urlsplit(url)
    if parsed.scheme in ('http','https') and parsed.netloc in ('www.senat.fr','senat.fr'):
        return parsed._replace(scheme='https').geturl()
    return None
def senate_terms(cache):
    starts=defaultdict(list); groups=defaultdict(list)
    for kind,output in [('mandats',starts),('groupes',groups)]:
        for row in csvrows(cache/('sen-'+kind+'.csv')):
            mid=row['Matricule']
            if mid not in PEOPLE: continue
            person,first,last,_=PEOPLE[mid]
            observed=(row.get('Prénom usuel',row.get('Prénom')),row.get('Nom usuel',row.get('Nom')))
            require(observed==(first,last),'Matricule et identité incohérents')
            if kind=='mandats': output[mid].append((row['Date de début de mandat'],row['Date de fin de mandat'],row['Identifiant mandat']))
            else: output[mid].append((row["Date de début d'appartenance"],row["Date de fin d'appartenance"],row['Code du groupe politique']))
    return starts, groups

def senate(cache):
    starts, groups = senate_terms(cache)
    records={}; choices=defaultdict(dict); sums=defaultdict(Counter); amendments=defaultdict(list)
    kinds={'1':'pour','2':'contre','3':'abstention','4':'non-votant'}
    with ZipFile(cache/'dosleg.zip') as z:
        require(z.namelist()==['dosleg.sql'] and z.getinfo('dosleg.sql').file_size<=192<<20,'Contenu inattendu pour DOSLEG')
        with z.open('dosleg.sql') as data:
            table=''
            for raw in data:
                if raw.startswith(b'COPY '):
                    table=raw.split()[1].decode('ascii')
                    continue
                if raw.startswith(b'\\.'):
                    table=''
                    continue
                if table not in ('scr','votsen','corscr'): continue
                cells=raw.rstrip(b'\r\n').decode('utf-8').split('\t')
                yr,num=cells[:2]
                if yr not in SESSIONS: continue
                key=(yr,num)
                if table=='votsen':
                    mid,choice=cells[2:4]
                    require(choice in kinds,'Catégorie de vote inconnue')
                    sums[key][kinds[choice]]+=1
                    if mid in PEOPLE:
                        require(mid not in choices[key], 'Plusieurs votes pour le même matricule')
                        choices[key][mid]=kinds[choice]
                elif table=='corscr':
                    if cells[3] and cells[3]!=r'\N':
                        amendments[key].append((int(cells[2]), {'notice':senate_text(cells[3]), 'source':senate_url(cells[4])}))
                else:
                    require(key not in records,'Scrutin en double')
                    records[key]=cells
    rows=[]
    for (yr,no),v in records.items():
        key=(yr,no)
        if not choices[key]: continue
        day=date.fromisoformat(v[4][:10]).isoformat()
        yes,no_count,voters,expressed=map(int,v[5:9])
        abst=sums[key]['abstention']
        require(yes==sums[key]['pour'] and no_count==sums[key]['contre'] and expressed+abst==voters,'Totaux et liste du Sénat incohérents')
        positions=[]
        for mid,choice in sorted(choices[key].items()):
            mandates={k for s,e,k in starts[mid] if indates(day,s,e)}
            group={k for s,e,k in groups[mid] if indates(day,s,e)}
            require(len(mandates)==1 and len(group)<=1,'Mandat ou groupe ambigu au jour du vote')
            positions.append({'candidat':PEOPLE[mid][0],'personne':mid,'vote':choice,'mandat':mandates.pop(),'groupe':next(iter(group),None),'intentions':[]})
        rows.append({'id':'senat-'+yr+'-'+no,'institution':'senat','periode':yr+'-'+str(int(yr)+1),'date':day,'numero':no,
                     'objet':senate_text(v[3]), 'decision':None,'pour':yes,'contre':no_count,'abstentions':abst,'positions':positions,
                     'misesAuPoint':[note for _,note in sorted(amendments[key],key=lambda item:item[0])],'source':f'https://www.senat.fr/scrutin-public/{yr}/scr{yr}-{no}.html'})
    return rows
def european(cache):
    person=json.loads((cache/'ep-history.json').read_bytes())['data'][0]
    require((person['id'],person['familyName'],person['givenName'])==('person/197694','Glucksmann','Raphaël'),'Identité européenne incohérente')
    def membership(day,key):
        out=[m for m in person['hasMembership'] if m.get('membershipClassification','').endswith('/'+key) and
             indates(day,m['memberDuring']['startDate'],m['memberDuring'].get('endDate'))]
        require(len(out)==1,'Appartenance européenne ambiguë')
        return out[0]
    rows=[]; meta=[]
    for day in MEETINGS:
        records=json.loads((cache/('ep-'+day+'.json')).read_bytes())['data']
        roll=[b for b in records if b.get('decision_method')=='def/ep-decision-methods/VOTE_ELECTRONIC_ROLLCALL']
        meta.append({'date':day,'decisions':len(records),'nominaux':len(roll)})
        for b in roll:
            options={'favor':'pour','against':'contre','abstention':'abstention'}
            choice=[v for k,v in options.items() if person['id'] in b.get('had_voter_'+k,[])]
            intended=[v for k,v in options.items() if person['id'] in b.get('had_voter_intended_'+k,[])]
            if not choice and not intended: continue
            require(len(choice)<=1 and len(intended)<=1,'Choix européen ambigu')
            mandate=membership(day,'EU_INSTITUTION')
            group=membership(day,'EU_POLITICAL_GROUP')
            identifier=b['activity_id']
            require(re.fullmatch('MTG-PL-'+day+r'-DEC-[0-9]+',identifier) and b['activity_date']==day,'Identifiant de séance inattendu')
            totals={name:b['number_of_votes_'+key] for key,name in options.items()}
            for key,name in options.items():
                require(totals[name]==len(b.get('had_voter_'+key,[])), 'Désaccord entre total et liste européenne')
            outcome={'ADOPTED':'adopté','REJECTED':'rejeté'}[b['decision_outcome'].split('/')[-1]]
            rows.append({'id':identifier,'institution':'parlement-europeen','periode':mandate['organization'].split('-')[-1],
              'date':day,'numero':b['notation_votingId'],'objet':b['activity_label']['fr'],'decision':outcome,
              'pour':totals['pour'],'contre':totals['contre'],'abstentions':totals['abstention'],
              'positions':[{'candidat':'glucksmann','personne':'197694','vote':next(iter(choice),None),'mandat':mandate['id'],
                            'groupe':group['organization'],'intentions':intended}],
              'misesAuPoint':[],'textes':[EP+s for s in b.get('decided_on_a_realization_of',[])],
              'source':EP+'eli/dl/event/'+identifier})
    return rows,meta
def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('cache',type=Path); cli.add_argument('--telecharger',action='store_true'); cli.add_argument('--verifier',action='store_true')
    a=cli.parse_args();prepare(a.cache,a.telecharger)
    europe,meetings=european(a.cache); rows=senate(a.cache)+europe
    require(len(rows)==len({r['id'] for r in rows}),'Identifiant dupliqué')
    rows.sort(key=lambda r:(r['date'],r['institution'],int(r['numero'])),reverse=True)
    persons={mid:{'candidat':p[0],'nom':p[1]+' '+p[2],'source':p[3]} for mid,p in PEOPLE.items()}
    persons['197694']={'candidat':'glucksmann','nom':'Raphaël Glucksmann','source':'https://www.europarl.europa.eu/meps/fr/197694/RAPHAEL_GLUCKSMANN/home'}
    result={'version':1,'consultation':'2026-11-24',
            'droitsSources':{'senat':{'producteur':'Sénat','miseAJour':'2026-11-24','licence':'https://data.senat.fr/licence/'},
            'parlement-europeen':{'producteur':'Parlement européen','licence':'https://data.europarl.europa.eu/en/discover/rules-on-the-european-parliaments-open-data'}},'sources':INPUTS,'sessionsSenat':sorted(SESSIONS),'sessionsEurope':meetings,'personnes':persons}
    compact=lambda d: json.dumps(d,ensure_ascii=False,separators=(',',':'))
    content=(compact(result)[:-1]+',"scrutins":[\n'+',\n'.join(compact(r) for r in rows)+'\n]}\n').encode()
    if a.verifier: require(DEST.read_bytes()==content,'Relevés historiques modifiés. Examiner les écarts avant de publier.')
    else: atomic(DEST,content)
    print(f"{len(rows)} scrutins, {sum(len(r['positions']) for r in rows)} mentions individuelles.")
if __name__=='__main__':main()
