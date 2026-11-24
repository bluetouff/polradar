#!/usr/bin/env python3
"""Build the Senate signature register from DOSLEG and the dated member directory."""
import argparse
import json
import re
import runpy
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import build_opener
from zipfile import ZipFile

BASE = runpy.run_path(str(Path(__file__).with_name('import-actes-senat-europe.py')))
ROOT = BASE['ROOT']
PEOPLE = BASE['PEOPLE']
INPUTS = {key: value for key, value in BASE['INPUTS'].items() if key.startswith(('dosleg', 'sen-'))}
DEST = ROOT / 'src/data/parlement/textes-senat.json'
require = BASE['require']
official = 'https://www.senat.fr/'
# In the Senate's public dump these authors have signatures on orphan text IDs.
# Any changes are reported by the byte-for-byte edition check.
KNOWN_ROLES = {'o': 'primo-signataire', 'n': 'coauteur', 'p': 'président'}
HEADER = re.compile(rb'^COPY ([a-z_]+) \(([a-z_0-9, ]+)\) FROM stdin;\r?\n$')

def records(cache, names):
    with ZipFile(cache / 'dosleg.zip') as archive:
        require(archive.namelist() == ['dosleg.sql'] and archive.getinfo('dosleg.sql').file_size <= 192 << 20, 'Archive DOSLEG non reconnue')
        with archive.open('dosleg.sql') as stream:
            table, columns = '', ()
            while line := stream.readline((1 << 20) + 1):
                require(len(line) <= 1 << 20, 'Ligne DOSLEG trop longue')
                if line.startswith(b'COPY '):
                    header = HEADER.fullmatch(line)
                    table = header[1].decode('ascii') if header else ''
                    if table in names:
                        columns = header[2].decode('ascii').split(', ')
                    continue
                if line.rstrip(b'\r\n') == b'\\.':
                    table = ''
                    continue
                if table in names:
                    cells = line.rstrip(b'\r\n').decode('utf-8').split('\t')
                    require(len(cells) == len(columns), 'Ligne de données DOSLEG incohérente')
                    yield table, dict(zip(columns, (None if c == r'\N' else c.strip() for c in cells)))

def relative_path(raw, prefix):
    require(prefix in ('leg', 'ga', 'rap', 'dossier-legislatif'), 'Collection documentaire inconnue')
    require(raw and re.fullmatch(r'[a-zA-Z0-9_./-]+', raw) and all(part not in ('', '.', '..') for part in raw.split('/')), 'Chemin documentaire inattendu')
    return official + prefix + '/' + raw

class DocumentHeading(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tag = ''
        self.text = {'title': [], 'h1': []}
    def handle_starttag(self, tag, attrs):
        if tag in self.text:
            self.tag = tag
    def handle_endtag(self, tag):
        if self.tag == tag:
            self.tag = ''
    def handle_data(self, value):
        if self.tag:
            self.text[self.tag].append(value)

def report_heading(cache, source, identifier, fetch):
    require(re.fullmatch(r'(a|l)[0-9]{2}-[0-9]{3}', identifier), 'Identifiant de rapport sans titre non reconnu')
    path = cache / ('notice-' + identifier + '.html')
    if fetch and not path.exists():
        with build_opener(BASE['NoRedirect']()).open(source, timeout=25) as response:
            raw = response.read((2 << 20) + 1)
        require(0 < len(raw) <= 2 << 20, 'Volume de notice inattendu')
        BASE['atomic'](path, raw)
    require(path.is_file() and not path.is_symlink() and path.stat().st_size <= 2 << 20, 'Notice du rapport absente')
    parser = DocumentHeading()
    parser.feed(path.read_text(encoding='utf-8', errors='replace'))
    for field in ('h1', 'title'):
        heading = ' '.join(' '.join(parser.text[field]).split()).removesuffix(' - Sénat').strip()
        if heading and heading.lower() not in ('sénat', 'recherche', 'rapport'):
            require('�' not in heading, 'Encodage du titre de rapport inconnu')
            return heading
    raise ValueError('Intitulé du rapport introuvable')

def generate(cache, fetch, consulted):
    BASE['prepare'](cache, fetch, INPUTS)
    terms, history = BASE['senate_terms'](cache)
    authors, kinds, roles, report_kinds = {}, {}, {}, {}
    for table, row in records(cache, {'auteur', 'typloi', 'rolsig', 'denrap'}):
        if table == 'auteur' and row['typautcod'] == '1' and row['autmat'] in PEOPLE:
            person = PEOPLE[row['autmat']]
            require(row['prenom'] == person[1] and row['nomuse'].casefold() == person[2].casefold(), 'Identité DOSLEG en désaccord avec le matricule')
            authors[row['autcod']] = row['autmat']
        elif table == 'typloi':
            kinds[row['typloicod']] = row['typloilib']
        elif table == 'rolsig':
            roles[row['signataire']] = row['rolsiglib']
        elif table == 'denrap':
            report_kinds[row['coddenrap']] = row['libdenrap']
    require(set(authors.values()) == PEOPLE.keys() and roles == KNOWN_ROLES, 'Auteurs ou rôles inconnus')
    signatures = [r for _,r in records(cache, {'ecr'}) if r['autcod'] in authors and r['typedoc'] in ('T', 'R')]
    selected_texts = {r['texcod'] for r in signatures if r['typedoc'] == 'T'}
    selected_reports = {r['rapcod'] for r in signatures if r['typedoc'] == 'R'}
    texts, reports, readings, stages, laws = {}, {}, {}, {}, {}
    for table,row in records(cache, {'texte','rap','lecass','lecture','loi'}):
        if table == 'texte' and row['texcod'] in selected_texts:
            texts[row['texcod']] = row
        elif table == 'rap' and row['rapcod'] in selected_reports:
            reports[row['rapcod']] = row
        elif table == 'lecass':
            stages[row['lecassidt']] = (row['lecidt'],row['codass'])
        elif table == 'lecture':
            readings[row['lecidt']] = row['loicod']
        elif table == 'loi':
            laws[row['loicod']] = (row['typloicod'],row['loiintori'] or row['loiint'],row['signet'])
    documents, incomplete = {}, []
    for s in signatures:
        mid = authors[s['autcod']]
        is_report = s['typedoc'] == 'R'
        code = s['rapcod'] if is_report else s['texcod']
        src = (reports if is_report else texts).get(code)
        if src is None:
            incomplete.append({'signature':s['ecrnum'],'document':code,'personne':mid,'motif':'document-absent-de-dosleg'})
            continue
        when = (src['date_depot'] if is_report else src['txtoritxtdat'])[:10]
        date.fromisoformat(when)
        mandate = {m for start, end, m in terms[mid] if BASE['indates'](when, start, end)}
        group = {g for start, end, g in history[mid] if BASE['indates'](when, start, end)}
        require(len(mandate) == 1 and len(group) <= 1, 'Mandat ou groupe ambigu au dépôt')
        if is_report:
            prefix = 'ga' if src['coddenrap'] == 'AMITI' else 'rap'
            source = relative_path(src['rapurl'], prefix)
            identifier = src['rapurl'].split('/')[0]
            require(re.fullmatch(r'[a-z0-9-]+',identifier), 'Code de rapport inconnu')
            title = src['raptitcou'] or src['raptil'] or report_heading(cache,source,identifier,fetch)
            kind = report_kinds[src['coddenrap']]
            nid, family = 'senat-rapport-' + identifier, 'rapport'
            number, sid = src['rapnum'], None
        else:
            read, chamber = stages[src['lecassidt']]
            require(chamber == 'S' and src['oritxtcod'] == '1', 'Initiative non sénatoriale')
            sid = readings[read]
            type_code, title, slug = laws[sid]
            kind = kinds[type_code]
            family = 'proposition-de-loi' if type_code in ('ppl','pplc','pplo','refe','ppro') else 'autre-texte'
            nid, number = 'senat-texte-' + code, src['texnum']
            source = relative_path(src['texurl'],'leg') if src['typurl'] == 'I' else relative_path(slug+'.html','dossier-legislatif')
        record = {
            'id': nid,
            'categorie': family,
            'nature': BASE['senate_text'](kind),
            'titre': BASE['senate_text'](title),
            'dateDepot': when,
            'session': src['sesann'],
            'numero': number,
            'dossierDOSLEG': sid,
            'source': source,
        }
        if nid in documents:
            require(record == {k:documents[nid][k]for k in record},'Deux actes incompatibles sous la même référence')
        else:
            documents[nid] = {**record,'codesDOSLEG':[],'signatures':[]}
        work = documents[nid]
        work['codesDOSLEG'].append(code)
        # The technical table labels signatories on reports in the same way as
        # bill authors. Keep its actual code, distinguish the display role.
        shown = 'signataire' if is_report and s['signataire'] == 'o' else roles[s['signataire']]
        sign = {
            'personne': mid,
            'candidat': PEOPLE[mid][0],
            'auteurDOSLEG': s['autcod'],
            'roleDOSLEG': s['signataire'],
            'role': shown,
            'mandat': mandate.pop(),
            'groupe': next(iter(group), None),
        }
        exists = next((p for p in work['signatures'] if p['personne'] == mid and p['roleDOSLEG'] == s['signataire']),None)
        if exists:
            require({k:exists[k] for k in sign} == sign,'Signatures incompatibles')
            exists['codesSignatures'].append(s['ecrnum'])
        else:
            work['signatures'].append({**sign,'codesSignatures':[s['ecrnum']]})
    for work in documents.values():
        work['codesDOSLEG'] = sorted(set(work['codesDOSLEG']),key=int)
        work['signatures'].sort(key=lambda s:(s['personne'],s['roleDOSLEG']))
        for signer in work['signatures']:
            signer['codesSignatures'].sort(key=int)
    require(len({d['source'] for d in documents.values()}) == len(documents),'Liens de publications en double')
    return {
        'version': 1,
        'consultation': consulted.isoformat(),
        'institution': 'Sénat',
        'sources': INPUTS,
        'licenceSource': 'https://data.senat.fr/licence/',
        'personnes': {mid: {'nom': p[1]+' '+p[2], 'candidat': p[0], 'source': p[3]} for mid,p in PEOPLE.items()},
        'signaturesSansDocument': sorted(incomplete, key=lambda s: int(s['signature'])),
        'documents': sorted(documents.values(), key=lambda r: (r['dateDepot'],r['id']), reverse=True),
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cache',type=Path)
    parser.add_argument('--telecharger',action='store_true')
    parser.add_argument('--verifier',action='store_true')
    parser.add_argument('--consulte-le', type=date.fromisoformat, default=date(2026, 11, 24), help='Date du relevé officiellement revu')
    args=parser.parse_args()
    value=generate(args.cache,args.telecharger,args.consulte_le)
    rows=value.pop('documents')
    compact=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'))
    content=(compact(value)[:-1]+',"documents":[\n'+',\n'.join(compact(row) for row in rows)+'\n]}\n').encode()
    if args.verifier:
        require(DEST.read_bytes()==content,'Les signatures historiques ont changé dans les sources')
    else:
        BASE['atomic'](DEST,content)
    print(f"{len(rows)} documents du Sénat, {len(value['signaturesSansDocument'])} signatures sans document.")

if __name__ == '__main__':
    main()
