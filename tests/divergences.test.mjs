import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  divergenceGroups,
  divergenceLayout,
  formatMetricValue,
  formatDivergenceValue,
} from '../src/lib/divergences.mjs';
import {
  positionsSchema,
  validateDivergencePositions,
} from '../src/lib/divergence-positions.mjs';
const read = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)),
  );
const measures = read('measures'),
  candidates = read('candidates'),
  themes = read('themes');
test('les axes reprennent les chiffres et leurs fiches, sans archives ni mélange d’âge général et de pénibilité', () => {
  const groups = divergenceGroups(measures, candidates, themes);
  assert.deepEqual(
    new Set(groups.map((group) => group.id)),
    new Set([
      'retraites-age-depart',
      'retraites-annuites',
      'travail-smic-mensuel-net',
      'travail-duree-hebdomadaire',
      'fiscalite-seuil-exoneration-heritage',
      'climat-nouveaux-epr2',
      'securite-places-prison-supplementaires',
    ]),
  );
  const hours = groups.find(
    (group) => group.id === 'travail-duree-hebdomadaire',
  );
  assert.deepEqual(
    hours.values.map((row) => [row.measureId, row.value]),
    [
      ['kazib-travail-temps', 28],
      ['herlin-semaine-40-heures', 40],
    ],
  );
  const prisons = groups.find(
    (group) => group.key === 'places-prison-supplementaires',
  );
  assert.equal(prisons.unit, 'places');
  assert.deepEqual(
    prisons.values.map((row) => [row.name, row.value]),
    [
      ['David Lisnard', 20000],
      ['Groupe Rassemblement national', 30000],
      ['Nicolas Dupont-Aignan', 40000],
    ],
  );
  const age = groups.find((group) => group.id === 'retraites-age-depart');
  assert.equal(age.values.length, 7);
  assert.equal(
    age.values.find((row) => row.name === 'Parti socialiste').value,
    62,
  );
  assert.equal(
    age.values.find((row) => row.candidate === 'dupont-aignan').value,
    62.75,
  );
  assert.equal(
    age.values.some((row) => row.candidate === 'lepen'),
    false,
  );
  assert.equal(age.values.find((row) => row.candidate === 'roussel').value, 60);
  assert.equal(age.values.find((row) => row.candidate === 'kazib').value, 60);
  assert.equal(
    age.values.find((row) => row.candidate === 'retailleau').value,
    63,
  );
  for (const group of groups)
    for (const row of group.values) {
      assert.equal(row.measure.scope === 'archive', false);
      assert.equal(row.measure.id, row.measureId);
      assert.ok(
        row.measure.metrics.some(
          (metric) => metric.value === row.value && metric.unit === group.unit,
        ) ||
          (group.key === 'smic-mensuel-net' &&
            row.measure.amounts.some(
              (amount) =>
                amount.value === row.value &&
                amount.unit === '€' &&
                amount.basis === 'net' &&
                amount.period === 'mois',
            )),
      );
    }
});
test('le SMIC mensuel net ne convertit ni les montants bruts ni les périodes annuelles', () => {
  const rows = measures.filter((row) =>
    [
      'melenchon-travail-1',
      'dupont-aignan-travail-smic',
      'tondelier-travail-1',
      'kazib-travail-smic',
    ].includes(row.id),
  );
  const group = divergenceGroups(rows, candidates, themes).find(
    (row) => row.key === 'smic-mensuel-net',
  );
  assert.deepEqual(
    group.values.map((row) => row.value).sort((a, b) => a - b),
    [1600, 1700, 2000],
  );
  assert.equal(
    group.values.some((row) => row.candidate === 'tondelier'),
    false,
  );
  for (const change of [
    (amount) => (amount.basis = 'brut'),
    (amount) => (amount.period = 'an'),
    (amount) => (amount.unit = '$'),
  ]) {
    const copy = structuredClone(rows);
    change(
      copy.find((row) => row.id === 'dupont-aignan-travail-smic').amounts[0],
    );
    assert.equal(
      divergenceGroups(copy, candidates, themes)
        .find((row) => row.key === 'smic-mensuel-net')
        .values.some((row) => row.candidate === 'dupont-aignan'),
      false,
    );
  }
  assert.equal(formatMetricValue(0.123456789), '0,123456789');
  assert.equal(formatMetricValue(0.000001), '0,000001');
  assert.equal(formatDivergenceValue(62.75, 'ans'), '62 ans et 9 mois');
});

test('unités, thèmes et valeurs contradictoires restent séparés', () => {
  const base = structuredClone(measures[0]);
  const fixture = [
    {
      ...base,
      id: 'a',
      candidate: 'melenchon',
      metrics: [
        {
          key: 'test',
          label: 'Test',
          value: 10,
          unit: '€',
          sourceId: 'lfi-social',
        },
      ],
    },
    {
      ...base,
      id: 'b',
      candidate: 'philippe',
      metrics: [
        {
          key: 'test',
          label: 'Test',
          value: 20,
          unit: '%',
          sourceId: 'lfi-social',
        },
      ],
    },
  ];
  assert.deepEqual(divergenceGroups(fixture, candidates, themes), []);
  fixture[1].metrics[0].unit = '€';
  assert.equal(divergenceGroups(fixture, candidates, themes).length, 1);
  assert.deepEqual(
    divergenceGroups(
      [
        ...fixture,
        {
          ...fixture[0],
          id: 'c',
          metrics: [{ ...fixture[0].metrics[0], value: 12 }],
        },
      ],
      candidates,
      themes,
    ),
    [],
  );
  fixture[1].theme = 'travail';
  assert.deepEqual(divergenceGroups(fixture, candidates, themes), []);
  fixture[1].theme = 'retraites';
  fixture.forEach((row) =>
    row.metrics.push({
      ...row.metrics[0],
      unit: '%',
      value: row.metrics[0].value / 10,
    }),
  );
  const distinct = divergenceGroups(fixture, candidates, themes);
  assert.equal(distinct.length, 2);
  assert.equal(new Set(distinct.map((row) => row.id)).size, 2);
});
test('les portraits restent dans le canevas et les valeurs égales occupent des lignes distinctes', () => {
  for (const width of [180, 240, 320, 768, 1440])
    for (const values of [
      [60, 65, 63, 60],
      [150000, 200000],
      [0, 0],
      [40, 45],
      [1600, 1700],
    ]) {
      const input = values.map((value) => ({ value }));
      const before = structuredClone(input);
      const map = divergenceLayout(input, width);
      assert.deepEqual(input, before);
      for (const point of map.points) {
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
        assert.ok(point.x - 29 >= 0 && point.x + 29 <= width);
        assert.ok(point.y - 29 >= 0 && point.y + 46 < map.height);
      }
      if (values[0] === values.at(-1) && values.length > 1) {
        assert.equal(map.points[0].x, map.points.at(-1).x);
        assert.notEqual(map.points[0].y, map.points.at(-1).y);
      }
      assert.ok(
        map.low <= Math.min(...values) && map.high >= Math.max(...values),
      );
      assert.ok(
        map.ticks.every(
          (tick) =>
            Number.isFinite(tick.value) && tick.x >= 0 && tick.x <= width,
        ),
      );
      if (width < 400) assert.ok(map.ticks.length <= 2);
    }
});
test('des données impossibles ne produisent jamais une échelle de remplacement', () => {
  for (const values of [[NaN, 1], [Infinity, 1], [-1, 0], [1], []])
    assert.throws(() =>
      divergenceLayout(
        values.map((value) => ({ value })),
        320,
      ),
    );
  for (const width of [NaN, Infinity, 100, 10001])
    assert.throws(() => divergenceLayout([{ value: 0 }, { value: 1 }], width));
});

test('les comparaisons par mesure gardent les conditions et l’auteur du document', () => {
  const dataset = {
    measures,
    candidates,
    themes,
    versions: read('versions'),
    sources: read('sources'),
  };
  const topics = positionsSchema.parse(read('divergence-positions'));
  const axes = divergenceGroups(measures, candidates, themes).map(
    ({ id }) => id,
  );
  assert.deepEqual(validateDivergencePositions(topics, dataset, axes), []);
  const csg = topics.find((topic) => topic.id === 'fiscalite-csg-salaires');
  const commentaryOnly = dataset.sources.map((source) =>
    source.kind === 'presse'
      ? { ...source, originalFormat: undefined }
      : source,
  );
  assert.ok(
    validateDivergencePositions(
      [csg],
      { ...dataset, sources: commentaryOnly },
      axes,
    ).some((error) => error.includes('glucksmann-csg-salaires')),
  );
  const retirements = topics.find(
    (topic) => topic.id === 'retraites-conditions-depart',
  );
  const entries = retirements.positions.flatMap(
    (position) => position.versions,
  );
  assert.equal(entries.length, 14);
  assert.ok(entries.includes('lepen-retraites-age-carriere-v1'));
  assert.ok(entries.includes('ps-retraites-age-cotisation-v1'));
  const energy = topics.find(
    (topic) => topic.id === 'climat-production-nucleaire',
  );
  const names = energy.positions.flatMap((position) => position.versions);
  assert.ok(names.includes('ps-climat-mix-v1'));
  assert.ok(names.includes('glucksmann-climat-1-v1'));
  for (const extra of [
    entries[0],
    'lepen-retraites-1-v1',
    'version-inconnue',
  ]) {
    const faulty = structuredClone(topics);
    faulty[0].positions.at(-1).versions.push(extra);
    assert.equal(validateDivergencePositions(faulty, dataset, axes).length, 1);
  }
});
