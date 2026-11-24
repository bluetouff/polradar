#!/usr/bin/env python3
"""Check the Commission's catalogue and import recognised election notice tables."""
import argparse
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unicodedata
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://www.commission-des-sondages.fr'
HOSTS = {'www.commission-des-sondages.fr', 'commission-des-sondages.fr'}
INDEX = ORIGIN + '/notices/medias/fichiers/bytag/14/2027-Presidentielle'
DOWNLOAD = re.compile(r'/notices/medias/fichiers/add/[1-9][0-9]{0,6}')
MONTHS = 'janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre'.split()
PERCENT = r'[0-9]{1,3}(?:[,.][0-9]{1,2})?'
COUNT = r'[0-9]{1,3}(?: [0-9]{3})+|[0-9]{1,6}'
spec = importlib.util.spec_from_file_location('source_transport', ROOT / 'scripts/watch-sources.py')
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)


def plain(value):
    return ' '.join(value.replace('’', "'").split())


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', plain(value).lower()) if not unicodedata.combining(c))


def required(pattern, text, message):
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        raise ValueError(message)
    return match


def number(value):
    return int(value.replace(' ', ''))


def percentage(value):
    result = Decimal(value.replace(',', '.'))
    if not 0 <= result <= 100:
        raise ValueError('Pourcentage hors limites')
    return float(result)


def civil(day, month, year):
    key = normalized(month)
    if key not in MONTHS:
        raise ValueError('Mois inconnu')
    return date(int(year), MONTHS.index(key) + 1, int(day))


def period(value):
    first, start_month, last, end_month, year = required(
        r'\bdu (\d{1,2})(?:er)?(?: ([a-zéû]+))? au (\d{1,2})(?:er)? ([a-zéû]+) (\d{4})\b',
        value, 'Période de terrain non reconnue',
    ).groups()
    end = civil(last, end_month, year)
    start = civil(first, start_month or end_month, year)
    if start > end and start_month:
        start = civil(first, start_month, int(year) - 1)
    if not timedelta(0) <= end - start <= timedelta(days=60):
        raise ValueError('Période de terrain incohérente')
    return start, end


class Catalogue(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.rejected = 0
        self.path = None
        self.in_row = False
        self.in_link = False
        self.label = []
        self.edition = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = (attributes.get('class') or '').split()
        if tag == 'p' and 'download-line' in classes:
            self.in_row = True
            self.path = None
            self.in_link = False
            self.label = []
            self.edition = []
        if tag == 'a' and self.in_row and 'pdf_download' in classes:
            self.path = attributes.get('href')
            self.in_link = True

    def handle_data(self, data):
        if self.in_row:
            (self.label if self.in_link else self.edition).append(data)

    def handle_endtag(self, tag):
        if tag == 'a':
            self.in_link = False
        if tag == 'p' and self.in_row:
            self.in_row = False
            if self.path and DOWNLOAD.fullmatch(self.path):
                self.rows.append((self.path, plain(''.join(self.label)), plain(''.join(self.edition))))
            else:
                self.rejected += 1


def catalogue_rows(body):
    if len(body) > transport.LIMIT:
        raise ValueError('Catalogue trop volumineux')
    catalogue = Catalogue()
    catalogue.feed(body.decode('utf-8', errors='strict'))
    if not 1 <= len(catalogue.rows) <= 3000 or catalogue.rejected:
        raise ValueError('Catalogue de la Commission incomplet')
    result = {}
    for path, title, edition in catalogue.rows:
        if not 1 <= len(title) <= 350 or any(ord(c) < 32 for c in title):
            raise ValueError('Libellé de notice invalide')
        number = re.match(r'^([0-9]{4,6}[A-Z]?)\b', title, re.I)
        month = re.fullmatch(r'- ([a-z]+) (\d{4})', normalized(edition))
        row = {
            'downloadId': path.rsplit('/', 1)[1],
            'number': number[1].lower() if number else None,
            'label': title,
            'listedMonth': (f'{month[2]}-{MONTHS.index(month[1])+1:02d}'
                            if month and month[1] in MONTHS else None),
        }
        if row['downloadId'] in result and result[row['downloadId']] != row:
            raise ValueError('Références contradictoires dans le catalogue')
        result[row['downloadId']] = row
    return list(result.values())


def notices(body, today):
    catalogue = Catalogue()
    catalogue.feed(body.decode('utf-8', errors='strict'))
    if not catalogue.rows:
        raise ValueError('Catalogue de la Commission non reconnu')
    recent = []
    for path, label, edition in catalogue.rows:
        identity = re.match(r'^(\d{4,6}[A-Z]?) (?:pres|presidentielle)\.?\s+(?:iv\b|intentions? de vote\b)', normalized(label), re.I)
        issue = re.fullmatch(r'- ([a-z]+) (\d{4})', normalized(edition))
        if not identity or not issue:
            continue
        month, year = issue.groups()
        listed_month = civil(1, month, year)
        if not (today - timedelta(days=21)).replace(day=1) <= listed_month <= today:
            continue
        written = re.search(r'\b(\d{1,2})(?:er)? ([a-z]+)(?: (\d{4}))?$', normalized(label))
        published = None
        if written and written.group(2) in MONTHS:
            published = civil(written.group(1), written.group(2), written.group(3) or year)
            if not today - timedelta(days=21) <= published <= today:
                continue
            if published.month != listed_month.month or published.year != listed_month.year:
                published = None
        institute = re.search(r'\b(ifop|yougov)\b', normalized(label))
        recent.append({
            'number': identity.group(1).lower(), 'url': ORIGIN + path,
            'published': published, 'institute': institute.group(1) if institute else None,
        })
    return sorted(recent, key=lambda item: (item['published'] or today, item['number']), reverse=True)


def layout(raw):
    if not raw.startswith(b'%PDF-') or len(raw) > transport.LIMIT:
        raise ValueError('PDF invalide ou trop volumineux')
    with tempfile.TemporaryFile() as output:
        subprocess.run(
            [sys.executable, '-I', __file__, '--pdf-layout'], input=raw,
            stdout=output, stderr=subprocess.DEVNULL, timeout=25, check=True,
        )
        if output.tell() > 1024 * 1024:
            raise ValueError('Texte de notice trop volumineux')
        output.seek(0)
        return json.loads(output.read())


def extract_pdf():
    # The PDF reader executes in the unprivileged collection job, with its own limits.
    import resource
    if sys.platform == 'linux':
        resource.setrlimit(resource.RLIMIT_AS, (384 << 20, 384 << 20))
    resource.setrlimit(resource.RLIMIT_FSIZE, (1 << 20, 1 << 20))
    from io import BytesIO
    from pypdf import PdfReader

    raw = sys.stdin.buffer.read(transport.LIMIT + 1)
    if not raw.startswith(b'%PDF-') or len(raw) > transport.LIMIT:
        raise ValueError('PDF invalide ou trop volumineux')
    reader = PdfReader(BytesIO(raw))
    if reader.is_encrypted or not 1 <= len(reader.pages) <= 80:
        raise ValueError('Notice chiffrée ou nombre de pages hors limites')
    pages = [page.extract_text(extraction_mode='layout') for page in reader.pages]
    print(json.dumps(pages, ensure_ascii=False))


def result(name, value, identities):
    name = plain(name)
    if not re.fullmatch(r"[^\W\d_][^\W\d_.' -]{0,79}(?:[.' -][^\W\d_]+)+", name, re.UNICODE):
        raise ValueError('Libellé de candidat non reconnu')
    known = identities.get(normalized(name))
    if known:
        key, label = known
    else:
        key = 'sonde-' + re.sub(r'[^a-z]+', '-', normalized(name)).strip('-')
        label = name
    return {'id': key, 'name': label, 'percentage': None if value in ('-', '–', '—') else percentage(value)}


def check_results(results, round, whole=False):
    reported = [item['percentage'] for item in results if item['percentage'] is not None]
    if (
        not (len(results) == 2 if round == 'second' else 5 <= len(results) <= 30)
        or len({item['id'] for item in results}) != len(results)
        or len(reported) < 2
        or (whole and any(not score.is_integer() for score in reported))
        or abs(sum(reported) - 100) > (min(2, len(reported) / 2) if whole else 1)
    ):
        raise ValueError('Tableau de résultats incomplet ou incohérent')


def ifop(pages, identities):
    method = plain(pages[1])
    commissioner = required(r"Etude réalisée par Ifop(?:-Fiducial)? pour (.+?) Echantillon\b", method, 'Commanditaire Ifop absent')[1]
    counts = required(
        rf"échantillon de ({COUNT}) personnes inscrites sur les listes électorales, extrait d'un échantillon de ({COUNT}) personnes",
        method, 'Effectifs Ifop non reconnus',
    )
    registered, sample = map(number, counts.groups())
    if 'méthode des quotas' not in method or 'questionnaire auto-administré en ligne' not in method:
        raise ValueError('Méthode Ifop non reconnue')
    dates = period(method)
    margin_page = plain(pages[2])
    required(r'intervalle de confiance [aà] 95\s*%', margin_page, 'Niveau de confiance Ifop absent')
    margins = [
        (number(match[1]), [percentage(value) for value in match[2].split()])
        for line in pages[2].splitlines()
        if (match := re.fullmatch(rf'\s*({COUNT})\s{{2,}}((?:{PERCENT}\s+){{5}}{PERCENT})\s*', line))
    ]
    metadata = {
        'commissioner': commissioner, 'sampleSize': sample, 'registeredSample': registered,
        'population': 'France, 18 ans et plus ; inscrits certains d’aller voter et exprimant une intention de vote.',
        'method': 'Internet, méthode des quotas : sexe, âge, profession, région et taille d’agglomération.',
    }
    scenarios = []
    for index, page in enumerate(pages, 1):
        combined = plain(page)
        title = re.match(r"Les intentions de vote à l'élection présidentielle\s*[–—-]\s*(Hypothèse .+?) Question\s*:", combined, re.I)
        if not title:
            continue
        round_name = required(r"\b(premier|second) tour de l'élection présidentielle", combined, 'Tour Ifop inconnu')[1].lower()
        if 'En pourcentage des suffrages exprimés' not in combined or 'Résultats publiés' not in combined:
            raise ValueError('Colonne publiée Ifop non reconnue')
        lines = [line.strip() for line in page.splitlines() if line.strip()]
        table = lines.index('(%)') + 1
        total = next(i for i in range(table, len(lines)) if re.fullmatch(r'TOTAL\s+100', lines[i]))
        points = [
            result(match[1], match[2], identities)
            for line in lines[table:total]
            if (match := re.fullmatch(rf'(.+?)\s{{2,}}({PERCENT}|[-–—])', line))
        ]
        if len(points) != total - table:
            raise ValueError('Ligne Ifop non reconnue')
        check_results(points, round_name)
        expressed = number(required(
            rf"et certaines d'aller voter interrogées, ({COUNT}) personnes ont exprimé une intention de vote",
            combined, 'Effectif exprimé Ifop absent',
        )[1])
        no_intention = percentage(required(rf'Ne se prononcent pas\s+({PERCENT})', combined, 'Non exprimés Ifop absents')[1])
        bases = [(size, values) for size, values in margins if size <= expressed]
        size, values = max(bases, key=lambda entry: entry[0])
        scenarios.append({
            'key': f'p{index}', 'round': round_name, 'noticePage': index,
            'scenario': f'{round_name.capitalize()} tour · {title[1]}',
            'usefulSample': expressed, 'noIntention': no_intention, 'results': points,
            'noIntentionNote': 'Part calculée sur l’ensemble des inscrits interrogés.',
            'margin': {'min': min(values), 'max': max(values), 'confidence': 95},
            'uncertainty': f'La plage à 95 % provient du tableau indicatif publié pour {size:,} personnes. Elle ne donne pas d’intervalle propre à chaque score.'.replace(',', '\u202f'),
        })
    if not scenarios:
        raise ValueError('Aucun scénario Ifop reconnu')
    return dates, metadata, scenarios


YOUGOV_HEADER = re.compile(r'Bruts\s{2,}Pondérés')
YOUGOV_ROW = re.compile(rf'(.+?)\s+-\s+(.+?)\s{{2,}}({PERCENT})\s*%\s{{2,}}({PERCENT})\s*%')


def yougov_table(lines, require_base, identities):
    cells = [line.strip() for line in lines]
    while cells and not cells[0]:
        cells.pop(0)
    base = None
    if require_base:
        match = re.fullmatch(rf'Base\s{{2,}}({COUNT})\s{{2,}}({COUNT})', cells.pop(0))
        if match is None:
            raise ValueError('Base brute et base pondérée non reconnues')
        base = number(match[1])
    rows = []
    for line in cells:
        if line.startswith('*Votants décidés') or 'Non pris en compte dans ce calcul' in line:
            break
        if not line:
            continue
        match = YOUGOV_ROW.fullmatch(line)
        if not match:
            raise ValueError('Ligne pondérée YouGov non reconnue')
        percentage(match[3])
        rows.append(result(match[1], match[4], identities))
    if not rows:
        raise ValueError('Il manque une colonne de résultats YouGov')
    return base, rows


def yougov(pages, identities):
    header = plain(pages[2])
    method = plain(pages[3])
    commissioner = required(r'Commanditaires? du sondage (.+?) Existence', header, 'Commanditaire YouGov absent')[1]
    counts = required(
        rf'({COUNT}) personnes représentatives de la population française \(18\+\) dont ({COUNT}) sont inscrites',
        method, 'Effectifs YouGov non reconnus',
    )
    sample, registered = map(number, counts.groups())
    if 'panel propriétaire de YouGov' not in method or "Les résultats aux questions d'intentions de vote sont pondérés" not in method:
        raise ValueError('Méthode YouGov non reconnue')
    dates = period(method)
    minimum, maximum = required(
        rf'plus ou moins ({PERCENT}) et ({PERCENT}) points', method, 'Marges YouGov absentes',
    ).groups()
    if not re.search(r'niveau de confiance de 95\s*%', plain(pages[4]), re.I):
        raise ValueError('Niveau de confiance YouGov absent')
    metadata = {
        'commissioner': commissioner, 'sampleSize': sample, 'registeredSample': registered,
        'population': 'France, 18 ans et plus ; inscrits ayant déclaré vouloir voter et choisi un candidat selon la définition YouGov.',
        'method': 'Panel en ligne. Pondération sociodémographique et politique, avec prise en compte de l’intention d’aller voter.',
        'margin': {'min': percentage(minimum), 'max': percentage(maximum), 'confidence': 95},
        'uncertainty': 'La notice donne la marge des résultats d’ensemble à 95 %. L’effectif utile est la base brute de chaque scénario. Les scores pondérés sont publiés à l’unité et leur somme peut différer de 100 %.',
        'rounding': 'unite',
    }
    expected = {'premier': set(), 'second': set()}
    observed = {'premier': set(), 'second': set()}
    scenarios = []
    for index, page in enumerate(pages, 1):
        combined = plain(page)
        stage = re.search(r"\b(premier|second) tour de l'élection présidentielle", combined, re.I)
        options = re.findall(r'\bHypothèse ([1-9]\d?)\b', page)
        if not stage or not options or '[Auprès des votants décidés' not in combined:
            continue
        round_name = stage[1].lower()
        lines = page.splitlines()
        if any(line.strip() == 'Questionnaire' for line in lines):
            expected[round_name].update(options)
            continue
        if not any(line.strip() == 'Résultats' for line in lines):
            continue
        header_line = next(i for i, line in enumerate(lines) if YOUGOV_HEADER.search(line))
        columns = list(YOUGOV_HEADER.finditer(lines[header_line]))
        if len(columns) not in (1, 2) or len(options) not in (1, 2):
            raise ValueError('Disposition des tableaux YouGov non reconnue')
        body = lines[header_line + 1:]
        if len(columns) == 2:
            boundary = columns[0].end() + 1
            tables = [
                yougov_table([line[:boundary] for line in body], True, identities),
                yougov_table([line[boundary:] for line in body], len(options) == 2, identities),
            ]
            if len(options) == 1:
                tables = [(tables[0][0], tables[0][1] + tables[1][1])]
        else:
            tables = [yougov_table(body, True, identities)]
        excluded = re.findall(r"Non pris en compte dans ce calcul\s*:\s*(\d+) répondants", combined)
        invalid = re.findall(r"Pondération non calculable pour (\d+) répondants", combined)
        if not len(tables) == len(options) == len(excluded) == len(invalid):
            raise ValueError('Effectifs YouGov incomplets')
        for option, (base, points), skip, missing in zip(options, tables, excluded, invalid):
            if option in observed[round_name] or base + int(skip) + int(missing) != sample:
                raise ValueError('Effectifs ou hypothèses YouGov incohérents')
            check_results(points, round_name, whole=True)
            observed[round_name].add(option)
            label = f'Hypothèse {option}' if round_name == 'premier' else ' / '.join(point['name'] for point in points)
            scenarios.append({
                'key': f'{round_name}-{option}', 'round': round_name, 'noticePage': index,
                'scenario': f'{round_name.capitalize()} tour · {label}',
                'usefulSample': base, 'noIntention': None, 'results': points,
            })
    if not scenarios or observed != expected:
        raise ValueError('Le questionnaire et les résultats YouGov ne correspondent pas')
    return dates, metadata, scenarios


def import_notice(notice, pages, identities, today):
    institute = {'ifop': 'Ifop', 'yougov': 'YouGov'}[notice['institute']]
    (start, end), metadata, scenarios = (ifop if institute == 'Ifop' else yougov)(pages, identities)
    publication = notice['published']
    if not start <= end <= publication <= today or publication - end > timedelta(days=10):
        raise ValueError('Chronologie de publication non confirmée')
    registered = metadata['registeredSample']
    if not 1 <= registered <= metadata['sampleSize'] or any(not 1 <= row['usefulSample'] <= registered for row in scenarios):
        raise ValueError('Effectifs de la notice incohérents')
    source_id = f"notice-commission-{notice['number']}"
    source = {
        'id': source_id, 'title': f"{institute} pour {metadata['commissioner']} · notice du {publication.isoformat()}",
        'url': notice['url'], 'kind': 'institution', 'published': publication.isoformat(), 'checked': today.isoformat(),
    }
    rows = [
        {
            'id': f"{notice['institute']}-{publication.isoformat()}-{notice['number']}-{row['key']}",
            'institute': institute, 'published': publication.isoformat(),
            'fieldworkStart': start.isoformat(), 'fieldworkEnd': end.isoformat(),
            'noticeSource': source_id, 'questionKey': 'intention-vote-presidentielle-2027',
            'question': {'status': 'a-relire'},
            **metadata, **{key: value for key, value in row.items() if key != 'key'},
        }
        for row in scenarios
    ]
    return source, rows


def collect(today):
    checked_at = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    output = {'checked': today.isoformat(), 'checkedAt': checked_at, 'status': 'available', 'sources': [], 'polls': [], 'review': []}
    polls = json.loads((ROOT / 'src/data/polls.json').read_text())
    source_rows = json.loads((ROOT / 'src/data/sources.json').read_text())
    candidate_rows = json.loads((ROOT / 'src/data/candidates.json').read_text())
    displayed = {row['noticeSource'] for row in polls}
    committed_urls = {row['url'] for row in source_rows if row['id'] in displayed}
    committed_ids = set(displayed)
    for url in committed_urls:
        match = re.search(r'/notices/files/notices/\d{4}/[^/]+/(\d+[a-z]?)-', url)
        if match:
            committed_ids.add(f'notice-commission-{match[1]}')
    identities = {
        normalized(row['name']): (row['id'], row['name'])
        for row in [point for poll in polls for point in poll['results']] + candidate_rows
    }
    try:
        status, mime, body = transport.fetch_reliably(INDEX, HOSTS)
        if status != 200 or mime not in ('text/html', 'application/xhtml+xml'):
            raise ValueError('Catalogue indisponible')
        output['catalogue'] = catalogue_rows(body)
        candidates = notices(body, today)
    except (OSError, ValueError):
        output['status'] = 'unavailable'
        return output
    seen = set()
    downloads = 0
    for item in candidates:
        identity = f"notice-commission-{item['number']}"
        if identity in committed_ids or item['url'] in committed_urls or identity in seen:
            continue
        seen.add(identity)
        pending = {'number': item['number'], 'url': item['url']}
        if not item['institute'] or item['published'] is None or downloads >= 8:
            output['review'].append({**pending, 'reason': 'notice-a-relire'})
            continue
        downloads += 1
        try:
            status, mime, raw = transport.fetch_reliably(item['url'], HOSTS)
        except (OSError, ValueError):
            status, mime, raw = None, '', None
        if status != 200:
            output['review'].append({**pending, 'reason': 'notice-inaccessible'})
            continue
        try:
            if mime not in ('application/pdf', 'application/octet-stream'):
                raise ValueError('Format inattendu')
            source, rows = import_notice(item, layout(raw), identities, today)
        except (OSError, ValueError, IndexError, StopIteration, subprocess.SubprocessError):
            output['review'].append({**pending, 'reason': 'format-non-reconnu'})
            continue
        output['sources'].append(source)
        output['polls'].extend(rows)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf-layout', action='store_true', help=argparse.SUPPRESS)
    if parser.parse_args().pdf_layout:
        extract_pdf()
        return
    if importlib.util.find_spec('pypdf') is None:
        raise SystemExit('Lecteur PDF absent de l’environnement de collecte.')
    output = ROOT / 'artifacts/polls-review'
    output.mkdir(parents=True, exist_ok=True)
    data = collect(datetime.now(ZoneInfo('Europe/Paris')).date())
    (output / 'review.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Sondages · {data['status']} · {len(data['sources'])} notices importables · {len(data['review'])} à relire.")
    for row in data['review']:
        print(f"- [Notice {row['number']}]({row['url']}) · {row['reason']}")


if __name__ == '__main__':
    main()
