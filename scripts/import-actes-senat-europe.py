#!/usr/bin/env python3
"""Produce a reviewed Senate / European Parliament selection from public institutional files."""
import argparse
import csv
import gzip
import hashlib
import json
import os
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from zipfile import ZipFile
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT/'src/data/parlement/senat-europe.json'
SENATE = 'https://data.senat.fr/data/'
EP = 'https://data.europarl.europa.eu/'
# Sessions complètes choisies dans le calendrier public, dont celles sans mention individuelle.
MEETINGS = (
    '2024-03-12', '2024-03-13', '2024-03-14', '2024-04-23',
    '2024-04-24', '2024-04-25', '2024-11-14', '2024-12-19',
    '2025-06-16', '2025-06-17', '2025-06-18', '2025-06-19',
    '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09',
    '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17',
    '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
    '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
    '2026-11-12',
)
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
            request = Request(url, headers={'User-Agent':'Polradar/archives-parlementaires (+https://polradar.fr/)'})
            with build_opener(NoRedirect()).open(request,timeout=40) as reply:
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
    days=defaultdict(list)
    for (yr,no),v in records.items():
        key=(yr,no)
        day=date.fromisoformat(v[4][:10]).isoformat()
        days[yr].append(day)
        if not choices[key]: continue
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
    sessions=[
        {'session': yr, 'debut': min(dates), 'fin': max(dates), 'scrutinsExamines': len(dates)}
        for yr, dates in sorted(days.items())
    ]
    mandates={}
    for mid, terms in starts.items():
        for start,end,key in terms:
            examined=sum(indates(day,start,end) for dates in days.values() for day in dates)
            if examined:
                mandates[key]={'candidat':PEOPLE[mid][0], 'institution':'senat',
                               'debut':start[:10], 'fin':end[:10] or None,
                               'scrutinsExamines':examined, 'source':PEOPLE[mid][3]}
    return rows,sessions,mandates
def european(cache):
    person=json.loads((cache/'ep-history.json').read_bytes())['data'][0]
    require((person['id'],person['familyName'],person['givenName'])==('person/197694','Glucksmann','Raphaël'),'Identité européenne incohérente')
    def membership(day,key):
        out=[m for m in person['hasMembership'] if m.get('membershipClassification','').endswith('/'+key) and
             indates(day,m['memberDuring']['startDate'],m['memberDuring'].get('endDate'))]
        require(len(out)==1,'Appartenance européenne ambiguë')
        return out[0]
    rows=[]; meta=[]; mandates={}
    for day in MEETINGS:
        records=json.loads((cache/('ep-'+day+'.json')).read_bytes())['data']
        roll=[b for b in records if b.get('decision_method')=='def/ep-decision-methods/VOTE_ELECTRONIC_ROLLCALL']
        meta.append({'date':day,'decisions':len(records),'nominaux':len(roll)})
        mandate=membership(day,'EU_INSTITUTION')
        key=mandate['id']
        if key not in mandates:
            dates=mandate['memberDuring']
            mandates[key]={'candidat':'glucksmann', 'institution':'parlement-europeen',
                           'debut':dates['startDate'][:10], 'fin':(dates.get('endDate') or '')[:10] or None,
                           'legislature':int(mandate['organization'].split('-')[-1]),
                           'scrutinsExamines':0, 'source':INPUTS['ep-history.json']}
        mandates[key]['scrutinsExamines']+=len(roll)
        for b in roll:
            options={'favor':'pour','against':'contre','abstention':'abstention'}
            choice=[v for k,v in options.items() if person['id'] in b.get('had_voter_'+k,[])]
            intended=[v for k,v in options.items() if person['id'] in b.get('had_voter_intended_'+k,[])]
            if not choice and not intended: continue
            require(len(choice)<=1 and len(intended)<=1,'Choix européen ambigu')
            group=membership(day,'EU_POLITICAL_GROUP')
            identifier=b['activity_id']
            require(re.fullmatch('MTG-PL-'+day+r'-DEC-[0-9]+',identifier) and b['activity_date']==day,'Identifiant de séance inattendu')
            voter_ids = [member for key in options for member in b.get('had_voter_'+key,[])]
            require(len(voter_ids)==len(set(voter_ids)), 'Personne dans plusieurs listes du scrutin')
            totals, counted = {}, []
            for key, name in options.items():
                voters = b.get('had_voter_'+key, [])
                total = b.get('number_of_votes_'+key)
                if total is None:
                    # Publish a missing zero only if all named votes account for the
                    # published attendance and the missing category contains no voters.
                    require(not voters and b.get('number_of_attendees') == len(voter_ids),
                            'Effectif absent sans décompte complet du scrutin')
                    total = 0
                    counted.append(name)
                require(total == len(voters), 'Désaccord entre total et liste européenne')
                totals[name] = total
            outcome={'ADOPTED':'adopté','REJECTED':'rejeté'}[b['decision_outcome'].split('/')[-1]]
            refs=b.get('recorded_in_a_realization_of',[])
            pv=[s for s in refs if re.fullmatch(r'eli/dl/doc/PV-[0-9]+-'+day+r'-RCV-ITM-[0-9]+',s)]
            require(len(pv)==len(refs),'Référence de procès-verbal européenne inconnue')
            rows.append({'id':identifier,'institution':'parlement-europeen','periode':mandate['organization'].split('-')[-1],
              'date':day,'numero':b['notation_votingId'],'objet':b['activity_label']['fr'],'decision':outcome,
              'pour':totals['pour'],'contre':totals['contre'],'abstentions':totals['abstention'],
              'positions':[{'candidat':'glucksmann','personne':'197694','vote':next(iter(choice),None),'mandat':mandate['id'],
                            'groupe':group['organization'],'intentions':intended}],
              'misesAuPoint':[],'textes':[EP+s for s in b.get('decided_on_a_realization_of',[])],
              'procesVerbal':[EP+s for s in pv], **({'totauxComptes':counted} if counted else {}),
              'source':EP+'eli/dl/event/'+identifier})
    return rows,meta,mandates
# Correspondances lues dans les annexes institutionnelles. Les titres seuls
# et les chiffres seuls ne déclenchent aucun rapprochement.
EUROPE_CONCORDANCES = {
    'pe9-20240313-intelligence-artificielle': ('MTG-PL-2024-03-13-DEC-166051', 'A9-0188/2023', '003', '808'),
    'pe9-20240313-liberte-medias': ('MTG-PL-2024-03-13-DEC-166183', 'A9-0264/2023', '002', '332'),
    'pe9-20240313-litiges-consommation': ('MTG-PL-2024-03-13-DEC-166083', 'A9-0060/2024', '004', None),
    'pe9-20240313-plateforme-litiges': ('MTG-PL-2024-03-13-DEC-166086', 'A9-0058/2024', '005', None),
}

def relier_scrutins_europe(rows, catalogue):
    decisions = {row['id']:row for row in rows}
    editorial = {row['id']:row for row in catalogue['ballots']}
    for key, (identifier, report, point, amendment) in EUROPE_CONCORDANCES.items():
        b, e = decisions[identifier], editorial[key]
        context = e['source']['locator']
        require(b['date'] == e['date'] and b['institution'] == e['chamber']
                and report in b['objet'] and report in context,
                'Objet ou institution du scrutin discordants : ' + key)
        if amendment:
            require(b['objet'].endswith('Am ' + amendment) and 'amendement ' + amendment in context,
                    'Amendement discordant : ' + key)
        expected_pv = EP + 'eli/dl/doc/PV-' + b['periode'] + '-' + b['date'] + '-RCV-ITM-' + point
        require(b['procesVerbal'] == [expected_pv], 'Point du PV discordant : ' + key)
        require((b['pour'], b['contre'], b['abstentions']) ==
                (e['tally']['for'], e['tally']['against'], e['tally']['abstained']),
                'Résultat collectif discordant : ' + key)
        position, = b['positions']
        original, = e['positions']
        require(position['personne'] == '197694' and position['candidat'] == original['candidate']
                and position['vote'] == original['choice'],
                'Position nominative discordante : ' + key)
        b['scrutinEditorial'] = key

# Une même séance historique emploie un identifiant pour le relevé du vote
# et un autre pour l’annuaire des députés. Ces paires ont été vérifiées
# individuellement dans les pièces du 15 février, sans recherche par patronyme.
CETA_MEMBERS = [
    ('lepen', '28210', '5332', 'Marine', 'Le Pen', 'Le Pen Marine', 'ENF', '4908',
     'MARINE_LE%20PEN', 'Débat du 15 février 2017, intervention 3-026-0000',
     'https://www.europarl.europa.eu/meps/en/28210/MARINE_LE%2BPEN/all-activities/plenary-speeches/8'),
    ('melenchon', '96742', '5916', 'Jean-Luc', 'Mélenchon', 'Mélenchon', 'GUE/NGL', '4281',
     'JEAN-LUC_MELENCHON', 'Explication de vote sur le rapport A8-0009/2017',
     'https://www.europarl.europa.eu/meps/fr/96742/JEAN-LUC_MELENCHON/all-activities/written-explanations/8'),
    ('philippot', '110977', '6474', 'Florian', 'Philippot', 'Philippot', 'ENF', '4908',
     'FLORIAN_PHILIPPOT', 'Mandat de la huitième législature',
     'https://www.europarl.europa.eu/meps/fr/110977/FLORIAN_PHILIPPOT/history/8'),
]

def ceta(cache, fetch, verify, catalogue):
    ballot, = [b for b in catalogue['ballots'] if b['id'] == 'pe8-20170215-ceta']
    day = ballot['date']
    xml_url = 'https://www.europarl.europa.eu/RegData/seance_pleniere/proces_verbal/2017/02-15/liste_presence/P8_PV(2017)02-15(RCV)_XC.xml'
    require(ballot['source']['url'] == xml_url, 'Annexe CETA inattendue')
    sources = {'rcv20170215.xml': xml_url}
    for _, person, _, _, _, _, _, group, *_ in CETA_MEMBERS:
        sources['ep-'+person+'.json'] = EP+'api/v2/meps/'+person+'?format=application%2Fld%2Bjson'
        sources['org-'+group+'.json'] = EP+'api/v2/corporate-bodies/'+group+'?format=application%2Fld%2Bjson'
    # Archived plenary files may refuse automated downloads. The unmodified
    # 2017 sitting is preserved with its published digest; no bypass or
    # alternative identity is used. Only the five public directory files
    # need a network connection when the cache is empty.
    if not (cache/'rcv20170215.xml').exists():
        with gzip.open(ROOT/'scripts/archives-parlementaires/pe8-ceta-2017-02-15.xml.gz','rb') as saved:
            seed = saved.read(16*1024*1024 + 1)
        require(len(seed)<=16*1024*1024 and hashlib.sha256(seed).hexdigest()==ballot['source']['sha256'],
                'Copie officielle du procès-verbal du CETA endommagée')
        cache.mkdir(parents=True,exist_ok=True)
        atomic(cache/'rcv20170215.xml',seed)
    prepare(cache, fetch, sources)
    xml = (cache/'rcv20170215.xml').read_bytes()
    digest = hashlib.sha256(xml).hexdigest()
    require(digest == ballot['source']['sha256'], 'Édition du procès-verbal CETA modifiée')
    root = ElementTree.fromstring(xml)
    require(root.get('Sitting.Date') == day and root.get('EP.Reference') == 'P8_PV(2017)02-15', 'Autre séance')
    vote, = root.findall("RollCallVote.Result[@Identifier='77143']")
    title = ''.join(vote.find('RollCallVote.Description.Text').itertext())
    require('A8-0009/2017' in title and 'approbation' in title
            and vote.get('Date','').startswith(day+' '), 'Autre vote que l’approbation du CETA')
    voters = {}
    for tag, tally_key, choice in [('For','for','pour'), ('Against','against','contre'), ('Abstention','abstained','abstention')]:
        section = vote.find('Result.' + tag)
        groups = section.findall('Result.PoliticalGroup.List')
        named = [(n,g.get('Identifier')) for g in groups for n in g.findall('PoliticalGroup.Member.Name')]
        require(len(named) == int(section.get('Number')) == ballot['tally'][tally_key], 'Effectif CETA discordant')
        for n, code in named:
            key = n.get('MepId')
            require(key and key not in voters,'Identifiant de vote individuel dupliqué ou vide')
            voters[key] = (n.text, code, choice)
    require(len(voters) == ballot['tally']['voters'], 'Décompte CETA incomplet')
    positions = []
    for candidate, person, archive, given, family, label, group, org, slug, extra, link in CETA_MEMBERS:
        member, = json.loads((cache/('ep-'+person+'.json')).read_bytes())['data']
        require((member['id'],member['notation_codictPersonId'],member['givenName'],member['familyName'])
                == ('person/'+person,person,given,family),'Identité de l’annuaire discordante')
        active = [m for m in member['hasMembership'] if
                  indates(day,m['memberDuring']['startDate'],m['memberDuring'].get('endDate'))]
        term, = [m for m in active if m.get('membershipClassification','').endswith('/EU_INSTITUTION')]
        faction, = [m for m in active if m.get('membershipClassification','').endswith('/EU_POLITICAL_GROUP')]
        require(term['organization'] == 'org/ep-8' and faction['organization'] == 'org/'+org,
                'Mandat ou groupe différent à la date du vote')
        group_data, = json.loads((cache/('org-'+org+'.json')).read_bytes())['data']
        require((group_data['id'],group_data['isVersionOf'],group_data['classification']) ==
                ('org/'+org,'org/'+group.replace('/','-'),'def/ep-entities/EU_POLITICAL_GROUP'),
                'Code de groupe CETA discordant')
        xml_name, xml_group, choice = voters[archive]
        require((xml_name,xml_group) == (label,group), 'Identité ou groupe du relevé discordant')
        require(choice == 'contre','Divergence avec la lecture du procès-verbal du CETA')
        positions.append({'candidate':candidate,'officialId':person,'officialName':given+' '+family,
                          'profileUrl':'https://www.europarl.europa.eu/meps/fr/'+person+'/'+slug+'/history/8',
                          'choice':choice,'groupAtTime':group_data['prefLabel']['fr'],
                          'archiveId':archive,'groupCode':group,'mandateId':term['id'],
                          'groupId':faction['organization'],'groupMembershipId':faction['id'],
                          'locator':'Annexe du 15 février 2017, scrutin 77143, voix contre, groupe '+group+', ligne « '+label+' », MepId '+archive+'.',
                          'confirmationTitle':extra,'confirmationUrl':link})
    result={'version':1,'checked':'2026-11-24','ballotId':ballot['id'],'date':day,'number':ballot['number'],
            'report':'A8-0009/2017','source':xml_url,'sha256':digest,'positions':positions}
    output=ROOT/'src/data/parlement/ceta-2017.json'
    content=(json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode()
    if verify: require(output.read_bytes()==content, 'Compléments nominatifs CETA modifiés')
    else: atomic(output,content)
    print(f"{len(positions)} positions nominatives recoupées sur le scrutin du CETA.")

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('cache',type=Path); cli.add_argument('--telecharger',action='store_true'); cli.add_argument('--verifier',action='store_true')
    cli.add_argument('--ceta',action='store_true',help='Vérifier les trois positions de la séance du 15 février 2017')
    a=cli.parse_args()
    catalogue=json.loads((ROOT/'src/data/legislative-votes.json').read_bytes())
    if a.ceta:
        ceta(a.cache,a.telecharger,a.verifier,catalogue)
        return
    prepare(a.cache,a.telecharger)
    europe,meetings,european_mandates=european(a.cache)
    relier_scrutins_europe(europe, catalogue)
    senate_rows,senate_sessions,senate_mandates=senate(a.cache)
    rows=senate_rows+europe
    require(len(rows)==len({r['id'] for r in rows}),'Identifiant dupliqué')
    rows.sort(key=lambda r:(r['date'],r['institution'],int(r['numero'])),reverse=True)
    persons={mid:{'candidat':p[0],'nom':p[1]+' '+p[2],'source':p[3]} for mid,p in PEOPLE.items()}
    persons['197694']={'candidat':'glucksmann','nom':'Raphaël Glucksmann','source':'https://www.europarl.europa.eu/meps/fr/197694/RAPHAEL_GLUCKSMANN/home'}
    result={'version':1,'consultation':'2026-11-24',
            'droitsSources':{'senat':{'producteur':'Sénat','miseAJour':'2026-11-24','licence':'https://data.senat.fr/licence/'},
            'parlement-europeen':{'producteur':'Parlement européen','licence':'https://data.europarl.europa.eu/en/discover/rules-on-the-european-parliaments-open-data'}},'sources':INPUTS,
            'sessionsSenat':sorted(SESSIONS),'couvertureSenat':senate_sessions,'sessionsEurope':meetings,
            'personnes':persons,'mandats':dict(sorted((senate_mandates | european_mandates).items()))}
    compact=lambda d: json.dumps(d,ensure_ascii=False,separators=(',',':'))
    content=(compact(result)[:-1]+',"scrutins":[\n'+',\n'.join(compact(r) for r in rows)+'\n]}\n').encode()
    if a.verifier: require(DEST.read_bytes()==content,'Relevés historiques modifiés. Examiner les écarts avant de publier.')
    else: atomic(DEST,content)
    print(f"{len(rows)} scrutins, {sum(len(r['positions']) for r in rows)} mentions individuelles.")
if __name__=='__main__':main()
