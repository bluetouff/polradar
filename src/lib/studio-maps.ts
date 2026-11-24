import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Graphic } from './chart-publication';
import { escapeHtml as esc } from './escape-html.mjs';
import { readCommune, readCommuneIndex } from './communes.mjs';
import areas from '../data/territoires/departements.json';
import sru from '../data/territoires/sru.json';
import elections from '../data/communes-2022.json';
import sources from '../data/communes-2022-sources.json';
import {
  aplSource,
  aplPage,
  sruSource,
  sruPage,
} from './dossiers-territoriaux';

const contour = {
  label: 'Etalab · contours départementaux 2026',
  url: 'https://etalab-datasets.geo.data.gouv.fr/contours-administratifs/2026/geojson/departements-1000m.geojson',
};
const colors = ['#d3e8e8', '#83bdc2', '#347f8a', '#163e55', '#d6d9db'];
const codeDep = (code: string) =>
  /^9[78]/.test(code) ? code.slice(0, 3) : code.slice(0, 2);
interface MapInput {
  family: 'soins' | 'logement' | 'elections';
  id: string;
  title: string;
  date: string;
  definition: string;
  note: string;
  page: string;
  source: { url: string; label: string };
  cols: string[];
  records: (string | number | null)[][];
  values: Map<string, number | null>;
  thresholds: number[];
  labels: string[];
}
function draw(m: MapInput): Graphic {
  const group = (n: number | null) =>
    n == null
      ? 4
      : m.thresholds.reduce((score, limit) => score + Number(n >= limit), 0);
  const paths = areas
    .map(
      (a) =>
        '<path d="' +
        esc(a.path) +
        '" fill="' +
        colors[group(m.values.get(a.code) ?? null)] +
        '"><title>' +
        esc(a.name) +
        '</title></path>',
    )
    .join('');
  const islands = [
    'Guadeloupe',
    'Martinique',
    'Guyane',
    'La Réunion',
    'Mayotte',
  ]
    .map(
      (name, i) =>
        '<text x="453" y="' +
        (72 + i * 79) +
        '" font-size="13" text-anchor="middle">' +
        name +
        '</text>',
    )
    .join('');
  const legend = [...m.labels, 'Indisponible ou hors champ']
    .map((name, i) => {
      const x = 28 + 290 * (i % 2),
        y = 526 + 25 * Math.floor(i / 2);
      return (
        '<rect x="' +
        x +
        '" y="' +
        (y - 12) +
        '" width="15" height="13" rx="2" fill="' +
        colors[i] +
        '" stroke="#708991"/><text x="' +
        (x + 22) +
        '" y="' +
        y +
        '" font-size="14">' +
        esc(name) +
        '</text>'
      );
    })
    .join('');
  const width = 640,
    height = 649;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="649" viewBox="0 0 640 649" role="img" aria-labelledby="carte-titre carte-desc"><title id="carte-titre">' +
    esc(m.title) +
    '</title><desc id="carte-desc">' +
    esc(m.definition) +
    ' ' +
    esc(m.note) +
    '</desc><rect width="640" height="649" rx="14" fill="#f1f6f6"/><path d="M14 0h612q14 0 14 14v77H0V14Q0 0 14 0" fill="#143b4b"/><g font-family="system-ui,sans-serif" fill="#153947"><text x="28" y="31" font-size="16" fill="#b3dfe0">' +
    esc(m.date) +
    '</text><text x="28" y="65" font-size="24" font-weight="650" fill="#fff">' +
    esc(m.title) +
    '</text><svg x="60" y="99" width="520" height="410" viewBox="0 0 520 410"><g stroke="#fcfdfc" stroke-width=".7" stroke-linejoin="round" fill-rule="evenodd">' +
    paths +
    '</g>' +
    islands +
    '</svg>' +
    legend +
    '<path d="M28 590h584" stroke="#a6c1c7"/><text x="28" y="613" font-size="14">' +
    esc(m.definition) +
    '</text><text x="28" y="635" font-size="12">' +
    esc(m.note) +
    '</text></g></svg>';
  return {
    svg,
    title: m.title,
    alt:
      m.title +
      '. ' +
      m.definition +
      ' ' +
      m.note +
      ' Valeurs départementales dans le tableau associé.',
    width,
    height,
    dateLabel: m.date,
    sources: [m.source, contour],
    page: m.page,
  };
}
function electionTotals() {
  const dir = 'public/data/communes/2022';
  const names = readCommuneIndex(
    JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')),
  );
  const seen = new Set<string>();
  const sums = new Map(
    areas.map((a) => [
      a.code,
      [
        { voters: 0, registered: 0 },
        { voters: 0, registered: 0 },
      ],
    ]),
  );
  const lengths = elections.rounds.map((r) => r.candidates.length);
  for (const file of readdirSync(dir).filter((s) =>
    /^(?:\d{2}|2[AB])\.json$/.test(s),
  )) {
    for (const entry of JSON.parse(
      readFileSync(join(dir, file), 'utf8'),
    ) as unknown[]) {
      if (
        !Array.isArray(entry) ||
        typeof entry[0] !== 'string' ||
        seen.has(entry[0])
      )
        throw Error('Résultat communal dupliqué ou mal identifié');
      const [code, first, second] = readCommune(entry, entry[0], lengths);
      seen.add(code);
      const values = sums.get(codeDep(code));
      if (!values) continue; // Overseas collectivities and consular votes lie outside the department map.
      for (const [idx, row] of [first, second].entries()) {
        values[idx].registered += row[0];
        values[idx].voters += row[1];
      }
    }
  }
  if (names.length !== seen.size || names.some(([code]) => !seen.has(code)))
    throw Error('Périmètre communal électoral incomplet');
  return sums;
}
export function studioMaps() {
  const health: MapInput = {
    family: 'soins',
    id: 'generalistes',
    title: 'Accès aux médecins généralistes',
    date: 'DREES · 2024',
    definition: 'Consultations accessibles par an et par habitant standardisé.',
    note: 'Moyennes départementales pondérées. Outre-mer en médaillons à des échelles distinctes.',
    page: aplPage,
    source: {
      label: 'DREES · accessibilité potentielle localisée 2024',
      url: aplSource,
    },
    cols: [
      'Département',
      'Nom',
      'Consultations accessibles par an et par habitant standardisé',
      'Millésime',
      'Source',
    ],
    records: areas.map((a) => [a.code, a.name, a.value, 2024, aplSource]),
    values: new Map(areas.map((a) => [a.code, a.value])),
    thresholds: [3, 4, 5],
    labels: ['Moins de 3', '3 à moins de 4', '4 à moins de 5', '5 ou plus'],
  };
  const counts = new Map(
    areas.map((a) => [a.code, { count: 0, yes: 0, known: 0 }]),
  );
  for (const [code, info] of Object.entries(sru)) {
    const item = counts.get(codeDep(code));
    if (!item) continue;
    item.count++;
    if (info.deficit !== null) {
      item.known++;
      if (info.deficit) item.yes++;
    }
  }
  const percent = (n: number, d: number) => (d > 0 ? (n / d) * 100 : null);
  const housing: MapInput = {
    family: 'logement',
    id: 'deficit-sru',
    title: 'Communes déficitaires en logement social',
    date: 'Ministère du Logement · inventaire au 1ᵉʳ janvier 2025',
    definition:
      'Part des communes au statut renseigné dans le fichier SRU (%).',
    note: 'Statuts non renseignés exclus. Périmètre ministériel du 1ᵉʳ janvier 2026.',
    page: sruPage,
    source: {
      label: 'Ministère du Logement · communes et inventaire SRU',
      url: sruSource,
    },
    cols: [
      'Département',
      'Nom',
      'Communes du fichier',
      'Statuts renseignés',
      'Communes documentées déficitaires',
      'Communes déficitaires parmi les statuts renseignés (%)',
      'Source',
    ],
    records: areas.map((a) => {
      const d = counts.get(a.code)!;
      return [
        a.code,
        a.name,
        d.count,
        d.known,
        d.yes,
        percent(d.yes, d.known),
        sruSource,
      ];
    }),
    values: new Map(
      [...counts].map(([code, d]) => [code, percent(d.yes, d.known)]),
    ),
    thresholds: [25, 50, 75],
    labels: [
      'Moins de 25 %',
      '25 à moins de 50 %',
      '50 à moins de 75 %',
      '75 % ou plus',
    ],
  };
  const turnout = electionTotals();
  const electoral: MapInput[] = elections.rounds.map((round, i) => {
    const source = sources.find(
      (s) => s.file === 't' + (i + 1) + '-subcom.txt',
    )!.source;
    return {
      family: 'elections',
      id: 'participation-2022-tour-' + (i + 1),
      title: 'Participation au ' + (i ? 'second' : 'premier') + ' tour de 2022',
      date: 'Ministère de l’Intérieur · ' + (i ? '24' : '10') + ' avril 2022',
      definition: 'Part des électeurs inscrits ayant voté, en pourcentage.',
      note: 'Somme des votants divisée par celle des inscrits dans les communes du département.',
      page: '/communes/',
      source: {
        label:
          'Ministère de l’Intérieur · résultats définitifs du tour ' + (i + 1),
        url: source,
      },
      cols: [
        'Département',
        'Nom',
        'Date',
        'Inscrits',
        'Votants',
        'Participation (%)',
        'Source',
      ],
      records: areas.map((a) => {
        const d = turnout.get(a.code)![i];
        return [
          a.code,
          a.name,
          round.date,
          d.registered,
          d.voters,
          percent(d.voters, d.registered),
          source,
        ];
      }),
      values: new Map(
        [...turnout].map(([id, list]) => [
          id,
          percent(list[i].voters, list[i].registered),
        ]),
      ),
      thresholds: [60, 70, 80],
      labels: [
        'Moins de 60 %',
        '60 à moins de 70 %',
        '70 à moins de 80 %',
        '80 % ou plus',
      ],
    };
  });
  return [health, housing, ...electoral].map((m) => ({
    ...m,
    graphic: draw(m),
  }));
}
