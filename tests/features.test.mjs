import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateDataset,
  validateFeatures,
  metricSchema,
  amountSchema,
  civilDateInParis,
} from '../src/lib/schema.mjs';
import {
  pollSeries,
  pollSignature,
  chartGeometry,
  metricGroups,
  filterEntries,
  exportCsv,
  csvValue,
  snapshotChanges,
  lineDiff,
  safePreferences,
} from '../src/lib/features.mjs';
import { immutableHistoryErrors } from '../src/lib/history.mjs';

const original = Object.fromEntries(
  [
    'candidates',
    'themes',
    'sources',
    'engagements',
    'events',
    'polls',
    'budget',
    'meta',
    'measures',
    'versions',
    'watch',
  ].map((name) => [
    name,
    JSON.parse(
      readFileSync(
        new URL(`../src/data/${name}.json`, import.meta.url),
        'utf8',
      ),
    ),
  ]),
);
const mutate = (change, validate = validateFeatures) => {
  const data = structuredClone(original);
  change(data);
  return validate(data);
};

test('les dates civiles suivent Paris aux changements de jour et de saison', () => {
  assert.equal(
    civilDateInParis(new Date('2026-11-16T23:30:00Z')),
    '2026-11-17',
  );
  assert.equal(
    civilDateInParis(new Date('2026-07-01T22:30:00Z')),
    '2026-07-02',
  );
  assert.deepEqual(
    mutate((data) => {
      data.versions.find((version) => version.number === 2).recordedAt =
        '2026-11-16T23:30:00Z';
    }),
    [],
  );
});
test('mesures, versions et relevés sont cohérents avec le corpus', () => {
  assert.deepEqual(validateFeatures(original), []);
  const rows = original.measures.filter(
    (row) => row.candidate === 'melenchon' && row.theme === 'retraites',
  );
  assert.ok(rows.length > 1);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  assert.ok(rows.every((row) => row.sourceRefs.length));
});
test('une modification courante doit correspondre à une nouvelle version complète', () => {
  assert.ok(
    mutate((data) => {
      data.measures[0].beneficiaries = 'Texte modifié sans version';
    }).some((error) => error.includes('courante incohérente')),
  );
  assert.ok(
    mutate((data) => {
      data.versions = data.versions.filter(
        (version) => version.id !== data.versions[0].id,
      );
    }).some((error) => error.includes('séquence')),
  );
  assert.ok(
    mutate((data) => {
      data.versions[0].snapshot.sourceRefs[0].sourceId = 'introuvable';
    }).some((error) => error.includes('source inconnue')),
  );
});
test('les dates, parents et catégories de versions sont contrôlés', () => {
  assert.ok(
    mutate((data) => {
      data.measures[0].parentId = data.engagements.find(
        (row) => row.candidate !== data.measures[0].candidate,
      ).id;
    }).some((error) => error.includes('parent')),
  );
  assert.ok(
    mutate((data) => {
      data.versions[0].recordedAt = '2099-01-01T12:00:00Z';
    }).some((error) => error.includes('horodatage')),
  );
  assert.ok(
    mutate((data) => {
      data.versions[0].kind = 'programme';
    }).some((error) => error.includes('première version')),
  );
  assert.ok(
    mutate((data) => {
      data.watch[0].checkedAt = '2099-01-01T12:00:00Z';
    }).some((error) => error.includes('veille future')),
  );
});
test('les champs inconnus restent distincts des valeurs numériques', () => {
  assert.ok(
    original.measures.some(
      (row) => row.beneficiaries === null && row.financing === null,
    ),
  );
  const metric = original.measures.find((row) => row.metrics.length).metrics[0];
  for (const value of [null, NaN, Infinity, -Infinity])
    assert.equal(metricSchema.safeParse({ ...metric, value }).success, false);
  const amount = original.measures.find((row) => row.amounts.length).amounts[0];
  for (const period of ['jour', 'cinq ans', ''])
    assert.equal(amountSchema.safeParse({ ...amount, period }).success, false);
});
test('l’historique accepte seulement l’ajout de versions', () => {
  const previous = original.versions.slice(0, 2),
    same = structuredClone(previous);
  assert.deepEqual(
    immutableHistoryErrors(previous, [...same, { id: 'nouvelle-version' }]),
    [],
  );
  same[0].summary = 'Réécriture';
  assert.ok(
    immutableHistoryErrors(previous, same).some((error) =>
      error.includes('réécrite'),
    ),
  );
  assert.ok(
    immutableHistoryErrors(previous, previous.slice(1)).some((error) =>
      error.includes('supprimée'),
    ),
  );
  const reordered = previous.map(({ id, ...row }) => ({ ...row, id }));
  assert.deepEqual(immutableHistoryErrors(previous, reordered), []);
});
test('le diff conserve chaque ligne et borne le calcul quadratique', () => {
  assert.deepEqual(lineDiff('a\nb', 'a\nc'), [
    { kind: 'equal', text: 'a' },
    { kind: 'added', text: 'c' },
    { kind: 'removed', text: 'b' },
  ]);
  const before = Array.from({ length: 600 }, (_, i) => `avant ${i}`).join('\n'),
    after = Array.from({ length: 600 }, (_, i) => `après ${i}`).join('\n');
  const diff = lineDiff(before, after);
  assert.equal(diff.length, 1200);
  assert.equal(
    diff
      .filter((row) => row.kind === 'removed')
      .map((row) => row.text)
      .join('\n'),
    before,
  );
  const a = original.versions[0].snapshot,
    b = { ...a, beneficiaries: 'Bénéficiaires précisés' };
  assert.deepEqual(
    snapshotChanges(a, b).map((row) => row.key),
    ['beneficiaries'],
  );
});
test('les sondages restent séparés par institut, tour, méthode et candidatures', () => {
  const rows = pollSeries(original.polls);
  assert.equal(rows.flat().length, original.polls.length);
  assert.ok(rows.some((group) => group.length >= 3));
  assert.ok(
    rows.every((group) =>
      group.every((poll) => pollSignature(poll) === pollSignature(group[0])),
    ),
  );
  assert.ok(new Set(original.polls.map((poll) => poll.institute)).size >= 7);
  const poll = original.polls[0];
  for (const update of [
    { institute: 'Autre institut' },
    { round: 'second' },
    { questionKey: 'autre-question' },
    { method: 'Autre méthode' },
    { population: 'Autre population' },
    { results: poll.results.slice(1) },
  ]) {
    const other = { ...poll, ...update };
    assert.notEqual(pollSignature(poll), pollSignature(other));
    assert.throws(
      () => chartGeometry([poll, other], [poll.results[0].id]),
      /incompatibles/,
    );
  }
  assert.equal(
    pollSignature(poll),
    pollSignature({ ...poll, results: [...poll.results].reverse() }),
  );
});
test('le graphique respecte les écarts de dates et conserve un axe à zéro', () => {
  const rows = pollSeries(original.polls)[0],
    id = rows[0].results[0].id;
  for (const width of [260, 320, 760]) {
    const geometry = chartGeometry(rows, [id], width),
      points = geometry.lines[0].points;
    assert.equal(geometry.ticks[0].value, 0);
    assert.equal(points[0].x, geometry.left);
    assert.equal(points.at(-1).x, geometry.right);
    const dates = rows.map((row) => Date.parse(row.fieldworkEnd));
    assert.ok(
      Math.abs(
        (points[1].x - points[0].x) / (points[2].x - points[0].x) -
          (dates[1] - dates[0]) / (dates[2] - dates[0]),
      ) < 1e-9,
    );
    assert.ok(points.every((point) => point.y >= 48 && point.y <= 258));
    assert.equal(geometry.dates.length, width < 580 ? 2 : 3);
  }
  const one = chartGeometry([rows[0]], [id], 320);
  assert.equal(one.lines[0].points.length, 1);
  assert.equal(one.lines[0].points[0].x, (one.left + one.right) / 2);
});
test('résultats dupliqués, totaux incomplets et dénominateurs impossibles sont refusés', () => {
  assert.ok(
    mutate((data) => {
      data.polls[0].results[1].id = data.polls[0].results[0].id;
    }, validateDataset).some((error) => error.includes('dupliqué')),
  );
  assert.ok(
    mutate((data) => {
      data.polls[0].results[0].percentage = 0;
    }, validateDataset).some((error) => error.includes('incompatibles')),
  );
  assert.ok(
    mutate((data) => {
      data.polls[0].registeredSample = data.polls[0].sampleSize + 1;
    }, validateDataset).some((error) => error.includes('inscrits')),
  );
  assert.ok(
    mutate((data) => {
      data.polls[0].margin.min = data.polls[0].margin.max + 1;
    }, validateDataset).some((error) => error.includes('incertitude')),
  );
  assert.deepEqual(
    mutate((data) => {
      data.polls[0].usefulSample = null;
    }, validateDataset),
    [],
  );
});
test('les paramètres comparés partagent une unité et excluent les archives', () => {
  const rows = original.measures.filter((row) => row.theme === 'retraites');
  const groups = metricGroups(rows, original.candidates);
  assert.ok(
    groups.some(
      (group) =>
        group.key === 'age-depart' &&
        group.values.length === 3 &&
        group.unit === 'ans',
    ),
  );
  const one = rows.find((row) =>
    row.metrics.some((metric) => metric.key === 'age-depart'),
  );
  const others = rows.filter((row) => row.id !== one.id);
  const changed = structuredClone(one);
  changed.metrics = changed.metrics.map((metric) => ({
    ...metric,
    unit: 'mois',
  }));
  assert.ok(
    metricGroups([changed, ...others], original.candidates).every(
      (group) => group.unit !== 'mois',
    ),
  );
  assert.deepEqual(
    metricGroups(
      rows.map((row) => ({ ...row, scope: 'archive' })),
      original.candidates,
    ),
    [],
  );
});
test('les facettes se combinent et ignorent casse et accents', () => {
  const rows = [
    {
      title: 'Réforme des retraites',
      text: 'Édouard Philippe',
      candidate: 'philippe',
      theme: 'retraites',
      type: 'mesure',
      year: '2026',
      scope: 'campagne',
    },
    {
      title: 'Réforme des retraites',
      text: 'Archive',
      candidate: 'philippe',
      theme: 'retraites',
      type: 'mesure',
      year: '2022',
      scope: 'archive',
    },
  ];
  assert.deepEqual(
    filterEntries(rows, {
      q: 'PHILIPPE reforme',
      candidate: 'philippe',
      theme: 'retraites',
      year: '2026',
      type: 'mesure',
    }),
    [rows[0]],
  );
  assert.deepEqual(filterEntries(rows, { q: 'absent' }), []);
  assert.equal(filterEntries(rows, { archives: '1' }).length, 2);
  assert.equal(filterEntries(rows, { candidate: 'inconnu' }).length, 0);
});
test('les exports CSV protègent les formules et préservent les URL externes', () => {
  for (const value of [
    '=SUM(A1:A2)',
    '+cmd',
    ' -7',
    '@formula',
    '\tcommande',
    '\rcommande',
  ])
    assert.ok(csvValue(value).startsWith('"\''));
  assert.equal(csvValue('une "citation"'), '"une ""citation"""');
  const csv = exportCsv([
    { title: '=formule', type: 'source', url: 'https://example.org/source' },
  ]);
  assert.ok(csv.includes('"https://example.org/source"'));
  assert.ok(!csv.includes('polradar.frhttps'));
});
test('le suivi rejette les données corrompues et les identifiants inconnus', () => {
  const empty = { candidates: [], themes: [], lastVisit: null };
  for (const raw of ['{', 'null', '[]', '"texte"'])
    assert.deepEqual(safePreferences(raw, ['philippe'], ['retraites']), empty);
  const value = safePreferences(
    JSON.stringify({
      candidates: ['philippe', 'philippe', '<script>', 2],
      themes: ['retraites', 'inconnu'],
      lastVisit: 'pas une date',
      token: 'secret',
    }),
    ['philippe'],
    ['retraites'],
  );
  assert.deepEqual(value, {
    candidates: ['philippe'],
    themes: ['retraites'],
    lastVisit: null,
  });
});

test('les recherches traitent les motifs extglob et regex comme du texte littéral', () => {
  for (const query of ['+(*a)', '+(*)', '!(foo)', '@(a|b)', '(a+)+$']) {
    const rows = [
      { id: 'literal', title: query, text: '' },
      { id: 'ordinary', title: 'Une proposition ordinaire', text: '' },
    ];
    assert.deepEqual(
      filterEntries(rows, { q: query }).map((row) => row.id),
      ['literal'],
    );
    assert.deepEqual(filterEntries([rows[1]], { q: query }), []);
  }
});
