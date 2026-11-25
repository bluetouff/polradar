import { attributionLabel, collectiveLabel } from './attribution.mjs';
/** Shared, dependency-free rules for charts, history and local search. */
export function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/\s+/g, ' ')
    .trim();
}
export function legacyPollSignature(poll) {
  return JSON.stringify([
    poll.institute,
    poll.round,
    poll.population,
    poll.method,
    poll.questionKey,
    poll.scenario,
    poll.results.map((result) => result.id).sort(),
  ]);
}
// Only typography is ignored. Numbers, negations, word order and accents remain significant.
function questionText(value) {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('fr')
    .replace(/[’']/gu, ' ')
    .replace(/[.,;:!?«»"()]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
export function pollSignature(poll) {
  const question = poll.question;
  const documented = question?.status === 'verifiee';
  const identity = documented
    ? [
        question.equivalence
          ? ['equivalence', question.equivalence.key]
          : ['texte', questionText(question.wording)],
        questionText(question.base),
      ]
    : ['observation', poll.id];
  return JSON.stringify([legacyPollSignature(poll), identity]);
}
export function comparePollWaves(a, b) {
  return (
    a.fieldworkEnd.localeCompare(b.fieldworkEnd) ||
    a.published.localeCompare(b.published) ||
    a.fieldworkStart.localeCompare(b.fieldworkStart) ||
    a.id.localeCompare(b.id)
  );
}
/** @param {import('./data').Poll[]} polls @returns {import('./data').Poll[][]} */
export function pollSeries(polls) {
  const groups = new Map();
  for (const poll of polls) {
    const key = pollSignature(poll);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(poll);
  }
  return [...groups.values()]
    .map((rows) => rows.sort(comparePollWaves))
    .sort(
      (a, b) =>
        b.at(-1).published.localeCompare(a.at(-1).published) ||
        comparePollWaves(b.at(-1), a.at(-1)),
    );
}
/** @param {import('./data').Poll[]} polls */
export function pollCoverage(polls, groups = pollSeries(polls)) {
  const institutes = [...new Set(polls.map((p) => p.institute))];
  const surveys = new Set(polls.map((p) => p.surveyId).filter(Boolean));
  return {
    observations: polls.length,
    firstRound: polls.filter((p) => p.round === 'premier').length,
    secondRound: polls.filter((p) => p.round === 'second').length,
    documentedSurveys: surveys.size,
    observationsWithoutSurvey: polls.filter((p) => !p.surveyId).length,
    notices: new Set(polls.map((p) => p.noticeSource)).size,
    series: groups.length,
    institutes,
  };
}
/** @param {import('./data').Poll['results'][number]} result */
export function pollScoreLabel(result) {
  if (result.below !== undefined)
    return 'Moins de ' + result.below.toLocaleString('fr-FR') + ' %';
  return result.percentage === null
    ? 'Non publié'
    : result.percentage.toLocaleString('fr-FR') + ' %';
}
/** @param {import('./data').Poll} poll */
export function rankedPollResults(poll) {
  return [...poll.results].sort(
    (a, b) => (b.percentage ?? -1) - (a.percentage ?? -1),
  );
}
const grammaticalWords = new Set(
  'a au aux avec chez dans d de des du en et l la le les par pour sur un une'.split(
    ' ',
  ),
);
const wordForms = new Map();
for (const family of [
  'supprimer suppression suppressions supprime supprimee suppriment supprimees supprimes',
  'baisser baisse baisses baissent',
  'reduire reduction reductions reduit reduite reduites reduits',
  'augmenter augmentation augmentations augmente augmentent',
  'retablir retablissement retablissements retablit restaurer restaure restauration reintroduire',
  'abroger abrogation abrogations abroge abrogee',
  'creer creation creations cree creee',
  'indexer indexation indexations indexe indexee indexes indexees',
  'exonerer exoneration exonerations exonere exoneres exoneree',
  'salaire salaires',
  'cotisation cotisations',
  'retraite retraites',
  'allocation allocations',
  'pension pensions',
  'revenu revenus',
  'impot impots',
  'logement logements',
  'ponderer ponderation',
  'entreprise entreprises',
  'region regions',
  'succession successions',
  'vote votes voter',
  'hopital hopitaux',
  'privatiser privatisation privatisations privatise privatises privatisee',
  'plafonner plafonnement plafonnements plafonne plafonnee plafonnes',
  'tarif tarifs prix',
  'annuler annulation annule annulee annulees',
  'jeune jeunes',
  'energie energies',
  'expulser expulsion expulsions',
  'calculer calcul calculs calcule calculee calcules',
  'medical medicaux medicale medicales',
  'soin soins',
]) {
  const forms = family.split(' ');
  for (const form of forms) wordForms.set(form, forms[0]);
}
const officialTerms = [
  [/\b(?:contribution sociale generalisee|c\.s\.g\.?)\b\.?/g, 'csg'],
  [
    /\bcontribution (?:au|pour le) remboursement de la dette sociale\b/g,
    'crds',
  ],
  [/\brevenu de solidarite active\b/g, 'rsa'],
  [/\bimpot de solidarite sur la fortune\b/g, 'isf'],
  [/\btaxe sur la valeur ajoutee\b/g, 'tva'],
  [/\ballocation aux adultes handicapes\b/g, 'aah'],
  [/\breferendum d['’ ]initiative citoyenne\b/g, 'ric'],
  [/\b(?:organisation des )?nations unies\b/g, 'onu'],
  [
    /\b(?:vaccination obligatoire|obligations? vaccinales?)\b/g,
    'obligation vaccinale',
  ],
  [
    /\b(?:salaire minimum(?: interprofessionnel de croissance)?|s\.m\.i\.c\.?)\b\.?/g,
    'smic',
  ],
  [/\b(?:flat[- ]tax|prelevement forfaitaire unique)\b/g, 'pfu'],
  [/\bimpot sur la fortune immobiliere\b/g, 'ifi'],
  [
    /\b(?:droits?(?: de mutation)?|fiscalite|imposition|impots?) (?:de |des |sur (?:les )?)successions?\b/g,
    'droit succession',
  ],
  [/\b(?:fiches?|feuilles?) de (?:paie|paye)\b/g, 'fiche paie'],
  [/\b(?:acceder|acces) aux soins\b/g, 'acces soin'],
  [/\blogements? socia(?:l|ux)\b/g, 'logement social'],
  [/\bagences? regionales? de sante\b/g, 'ars'],
  [/\blutte ouvriere\b/g, 'lo'],
  [/\bremettre la retraite\b/g, 'retablir la retraite'],
  [/\b(pouvoir|cout) d['’]achat\b/g, '$1 achat'],
  [/\beuros?\b/g, '€'],
];
function searchTokens(text, index = false) {
  const original = normalize(text).replace(/(\d) (?=\d{3}(?:\D|$))/g, '$1');
  let expanded = original;
  for (const [phrase, acronym] of officialTerms)
    expanded = expanded.replace(phrase, acronym);
  let searchable =
    index && original !== expanded ? `${original} ${expanded}` : expanded;
  if (
    index &&
    /\b(?:ter|fret ferroviaire|liaison ferroviaire)\b/.test(original)
  )
    searchable += ' transport ferroviaire';
  if (
    index &&
    /\b(?:plafonn\w*|factur\w*|vendr\w*)\b/.test(original) &&
    /\bcout de production\b/.test(original)
  )
    searchable += ' prix';
  return (searchable.match(/[\p{L}\p{N}]+(?:[.,]\d+)?|[%€]/gu) || []).map(
    (word) => wordForms.get(word) ?? word.replace(/(\d),(\d)/g, '$1.$2'),
  );
}
/** @param {import('./data').Measure} measure */
export function measureSearchText(measure, candidateName, themeLabel) {
  const collective = collectiveLabel(measure);
  const format = (entry) =>
    `${entry.label} ${entry.value.toLocaleString('fr-FR')} ${entry.unit}`;
  return [
    collective ? `${collective} · Dossier de ${candidateName}` : candidateName,
    themeLabel,
    measure.description,
    measure.beneficiaries,
    measure.timing,
    measure.financing,
    ...measure.metrics.map(format),
    ...measure.amounts.map(
      (amount) =>
        `${format(amount)} ${amount.period} ${amount.basis === 'non-applicable' ? '' : amount.basis}`,
    ),
  ]
    .filter(Boolean)
    .join(' ');
}
const indexedWords = new WeakMap();
function indexedEntry(row) {
  const cached = indexedWords.get(row);
  if (cached?.originalTitle === row.title && cached?.originalText === row.text)
    return cached;
  const title = new Set(searchTokens(row.title, true));
  const words = new Set([...title, ...searchTokens(row.text, true)]);
  const result = {
    originalTitle: row.title,
    originalText: row.text,
    heading: normalize(row.title),
    title,
    words,
  };
  indexedWords.set(row, result);
  return result;
}

function matchesWord(entry, word) {
  if (entry.words.has(word)) return true;
  if (word.length < 4 || !/^[a-z]+$/.test(word) || wordForms.has(word))
    return false;
  for (const other of entry.words) if (other.startsWith(word)) return true;
  return false;
}

function oneTypo(word, other) {
  if (word === other || Math.abs(word.length - other.length) > 1) return false;
  const short = word.length <= other.length ? word : other;
  const long = word.length > other.length ? word : other;
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  if (short.length < long.length) return short.slice(i) === long.slice(i + 1);
  return (
    short.slice(i + 1) === long.slice(i + 1) ||
    (short[i] === long[i + 1] &&
      short[i + 1] === long[i] &&
      short.slice(i + 2) === long.slice(i + 2))
  );
}

function candidateSpelling(rows, tokens) {
  if (tokens.length < 2 || tokens.some((word) => !/^[a-z]{2,32}$/.test(word)))
    return [];
  const consonants = (word) => word.replace(/oua/g, 'wa');
  const candidates = rows.filter((row) => {
    if (row.type !== 'candidat') return false;
    const name = searchTokens(row.title);
    if (name.length !== tokens.length) return false;
    const differences = tokens.filter((word, i) => word !== name[i]);
    return (
      differences.length === 1 &&
      name.at(-1) === tokens.at(-1) &&
      tokens.every((word, i) => consonants(word) === consonants(name[i]))
    );
  });
  return candidates.length === 1 ? candidates : [];
}

/** @template T @param {T[]} entries @returns {T[]} */
export function filterEntries(entries, filters) {
  const selection = entries.filter(
    (entry) =>
      (!filters.candidate ||
        entry.candidate === filters.candidate ||
        entry.candidates?.includes(filters.candidate)) &&
      (!filters.theme ||
        entry.theme === filters.theme ||
        entry.themes?.includes(filters.theme)) &&
      (!filters.type || entry.type === filters.type) &&
      (!filters.year || entry.year === filters.year) &&
      (filters.scope
        ? entry.scope === filters.scope
        : filters.archives === '1' || entry.scope !== 'archive'),
  );
  const input = normalize(filters.q || '').slice(0, 200);
  if (!input) return selection;
  // Operator-like input and punctuation-only queries remain literal text.
  const literal = /[+*|[\]{}^$@\\]|[?!]\(/.test(input);
  const query = input
    .replace(
      /^(?:ou (?:sont|trouver|consulter)|comment (?:trouver|consulter)|quels? (?:outils|chiffres|documents) pour (?:lire|comprendre|consulter))\s+/u,
      '',
    )
    .replace(
      /^(?:qui|quel candidat|quels candidats|quelle candidature|que) (?:veut|veulent|propose|proposent|souhaite|souhaitent|dit|disent|prevoit|prevoient)\s+/u,
      '',
    )
    .replace(/^comment (?:mieux )?/u, '')
    .replace(/^(?:quels?|quelles?|identifier|trouver) /u, '')
    .replace(/\bque (?:veut|souhaite|compte|entend)\b/gu, '')
    .replace(/\?$/, '')
    .trim();
  const tokens = [
    ...new Set(
      searchTokens(query).filter((word) => !grammaticalWords.has(word)),
    ),
  ];
  if (literal || !tokens.length)
    return selection.filter((row) =>
      normalize(`${row.title} ${row.text}`).includes(input),
    );
  const ranked = [];
  const near = [];
  for (const row of selection) {
    const entry = indexedEntry(row);
    const missing = tokens.filter((word) => !matchesWord(entry, word));
    const titleMatches = tokens.filter((word) => entry.title.has(word)).length;
    const editorialMatch =
      missing.length === 0 &&
      tokens.length >= 2 &&
      ((row.type === 'question' &&
        titleMatches >= Math.min(2, tokens.length - 1)) ||
        (row.type === 'dossier' && titleMatches === tokens.length));
    const score =
      (tokens.length === 1 && row.type === 'theme' ? 2 : 0) +
      titleMatches * 3 +
      tokens.filter((word) => entry.words.has(word)).length +
      (editorialMatch ? 4 : 0) +
      (entry.heading === query ? 8 : entry.heading.includes(query) ? 3 : 0);
    if (!missing.length) ranked.push({ row, score });
    else if (missing.length === 1 && /^[a-z]{5,32}$/.test(missing[0]))
      near.push({ row, score, entry, word: missing[0] });
  }
  if (!ranked.length && !/[0-9]/.test(query)) {
    const names = candidateSpelling(selection, tokens);
    if (names.length) return names;
    // Only one spelling correction, and only if its interpretation is unique.
    const corrections = new Map();
    for (const { row, score, entry, word } of near) {
      for (const other of entry.words) {
        if (!/^[a-z]{5,32}$/.test(other) || !oneTypo(word, other)) continue;
        const key = word + ' ' + other;
        if (!corrections.has(key)) corrections.set(key, []);
        const matches = corrections.get(key);
        matches.push({
          row,
          score:
            score +
            (entry.title.has(other) ? 3 : 0) +
            (entry.heading === other ? 8 : 0),
        });
      }
    }
    if (corrections.size === 1)
      return corrections
        .values()
        .next()
        .value.sort((a, b) => b.score - a.score)
        .map(({ row }) => row);
  }
  return ranked.sort((a, b) => b.score - a.score).map(({ row }) => row);
}

export function csvValue(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function exportCsv(rows) {
  return (
    '\uFEFF' +
    [
      [
        'Titre',
        'Type',
        'Candidat',
        'Thème',
        'Année',
        'URL',
        'Auteur du document',
      ],
      ...rows.map((row) => [
        row.title,
        row.type,
        row.candidate || '',
        row.theme || '',
        row.year || '',
        new URL(row.url, 'https://polradar.fr').href,
        row.author ?? '',
      ]),
    ]
      .map((row) => row.map(csvValue).join(';'))
      .join('\r\n')
  );
}
export function snapshotChanges(before, after) {
  const keys = [
    'title',
    'description',
    'beneficiaries',
    'timing',
    'financing',
    'metrics',
    'amounts',
    'sourceRefs',
    'scope',
    'partyAuthor',
    'edition',
    'checked',
  ];
  return keys
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }));
}
export function lineDiff(before, after) {
  const a = String(before || '').split('\n'),
    b = String(after || '').split('\n');
  // Bound quadratic work while preserving the full text of large revisions.
  if (a.length * b.length > 250000)
    return [
      ...a.map((text) => ({ kind: 'removed', text })),
      ...b.map((text) => ({ kind: 'added', text })),
    ];
  const dp = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const result = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j])
      (result.push({ kind: 'equal', text: a[i++] }), j++);
    else if (j < b.length && (i === a.length || dp[i][j + 1] >= dp[i + 1][j]))
      result.push({ kind: 'added', text: b[j++] });
    else result.push({ kind: 'removed', text: a[i++] });
  }
  return result;
}
export function safePreferences(raw, candidates, themes) {
  try {
    const value = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return { candidates: [], themes: [], lastVisit: null };
    const ids = (items, allowed) => [
      ...new Set(
        Array.isArray(items)
          ? items.filter((id) => typeof id === 'string' && allowed.includes(id))
          : [],
      ),
    ];
    return {
      candidates: ids(value.candidates, candidates),
      themes: ids(value.themes, themes),
      lastVisit:
        typeof value.lastVisit === 'string' &&
        Number.isFinite(Date.parse(value.lastVisit))
          ? value.lastVisit
          : null,
    };
  } catch {
    return { candidates: [], themes: [], lastVisit: null };
  }
}
/**
 * @param {import('./data').Measure[]} measures
 * @param {import('./data').Candidate[]} candidates
 * @returns {Array<{key:string,label:string,unit:string,values:Array<{candidate:string,name:string,value:number,measureId:string}>}>}
 */
export function metricGroups(measures, candidates) {
  const groups = new Map();
  for (const measure of measures) {
    if (measure.scope === 'archive') continue;
    for (const metric of measure.metrics) {
      const key = JSON.stringify([metric.key, metric.unit]);
      if (!groups.has(key))
        groups.set(key, {
          key: metric.key,
          label: metric.label,
          unit: metric.unit,
          values: [],
        });
      const group = groups.get(key);
      group.values.push({
        candidate: measure.candidate,
        name: attributionLabel(
          measure,
          candidates.find((c) => c.id === measure.candidate)?.name ??
            measure.candidate,
        ),
        value: metric.value,
        measureId: measure.id,
      });
    }
  }
  return [...groups.values()].filter((group) => {
    if (
      group.values.some((row) => !Number.isFinite(row.value) || row.value < 0)
    )
      return false;
    const seen = new Map();
    for (const row of group.values) {
      const key = JSON.stringify([row.candidate, row.name]);
      if (seen.has(key) && seen.get(key) !== row.value) return false;
      seen.set(key, row.value);
    }
    group.values = group.values.filter(
      (row, index, rows) =>
        rows.findIndex(
          (r) => r.candidate === row.candidate && r.name === row.name,
        ) === index,
    );
    return group.values.length >= 2;
  });
}
export const pollIdentities = [
  'lepen',
  'melenchon',
  'philippe',
  'glucksmann',
  'attal',
  'retailleau',
  'roussel',
  'tondelier',
  'zemmour',
  'villepin',
  'dupont-aignan',
  'arthaud',
];
export function pollColor(id) {
  const index = pollIdentities.indexOf(id);
  return index < 0 ? 11 : index;
}
/** @param {import('./data').Poll[]} rows @param {string[]} activeIds @param {number} width */
export function chartGeometry(rows, activeIds, width = 760) {
  const left = width < 480 ? 36 : 52,
    right = width - 24;
  if (!rows.length)
    return {
      width,
      left,
      right,
      max: 100,
      lines: [],
      ticks: [],
      dates: [],
      waves: [],
    };
  if (rows.some((row) => pollSignature(row) !== pollSignature(rows[0])))
    throw Error('Scénarios incompatibles');
  const values = rows.flatMap((row) =>
    row.results
      .filter((result) => activeIds.includes(result.id))
      .map((result) => result.percentage)
      .filter((value) => value !== null),
  );
  const max = Math.max(10, Math.ceil(Math.max(0, ...values) / 10) * 10);
  const start = Date.parse(rows[0].fieldworkEnd + 'T12:00:00Z'),
    end = Date.parse(rows.at(-1).fieldworkEnd + 'T12:00:00Z');
  const x = (row) =>
    end === start
      ? (left + right) / 2
      : left +
        ((Date.parse(row.fieldworkEnd + 'T12:00:00Z') - start) /
          (end - start)) *
          (right - left);
  const y = (value) => 258 - (value / max) * 210;
  const lines = rows[0].results
    .filter((result) => activeIds.includes(result.id))
    .map((result) => {
      const points = rows.flatMap((row, index) => {
        const value = row.results.find(
          (item) => item.id === result.id,
        ).percentage;
        return value === null
          ? []
          : [{ x: x(row), y: y(value), value, date: row.fieldworkEnd, index }];
      });
      return {
        id: result.id,
        name: result.name,
        color: pollColor(result.id),
        points,
        path: points
          .map(
            (point, index) =>
              `${points[index - 1]?.index === point.index - 1 ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
          )
          .join(' '),
      };
    })
    .filter((line) => line.points.length);
  const tickCount = 4;
  return {
    width,
    left,
    right,
    max,
    lines,
    waves: rows.map((row, index) => ({
      index,
      date: row.fieldworkEnd,
      x: x(row),
    })),
    ticks: Array.from({ length: tickCount + 1 }, (_, index) => ({
      value: (index * max) / tickCount,
      y: y((index * max) / tickCount),
    })),
    dates: [
      ...new Set(
        width < 580
          ? [0, rows.length - 1]
          : [0, Math.floor((rows.length - 1) / 2), rows.length - 1],
      ),
    ].map((index) => ({
      index,
      date: rows[index].fieldworkEnd,
      x: x(rows[index]),
    })),
  };
}
