import assert from 'node:assert/strict';
import test from 'node:test';
import { corpusCounts, corpusActivity } from '../src/lib/corpus-counts.mjs';
import { sourceRefSchema } from '../src/lib/schema.mjs';

test('les proportions comptent les fiches une fois et séparent parti, campagne, orientation et archive', () => {
  const candidates = [
    { id: 'b', name: 'B' },
    { id: 'a', name: 'A', withdrawnOn: '2026-11-21' },
    { id: 'c', name: 'C' },
  ];
  const themes = [
    { id: 'justice', label: 'Justice' },
    { id: 'ecole', label: 'École' },
  ];
  const measures = ['campagne', 'parti', 'orientation', 'archive'].map(
    (scope, i) => ({
      id: String(i),
      scope,
      revision: i + 1,
      candidate: i === 3 ? 'a' : 'b',
      theme: i % 2 ? 'justice' : 'ecole',
    }),
  );
  const c = corpusCounts({ measures, candidates, themes });
  assert.equal(c.proposals, 2);
  assert.equal(c.current, 3);
  assert.equal(c.total, 4);
  assert.deepEqual(
    c.candidates.map((x) => x.id),
    ['a', 'b', 'c'],
  );
  assert.equal(c.candidates[0].counts.archive, 1);
  assert.equal(c.candidates[2].counts.campagne, 0);
  assert.equal(c.themes[0].counts.parti, 1);
  assert.equal(c.themes[1].counts.orientation, 1);
  assert.equal(corpusCounts({ measures: [], candidates, themes }).total, 0);
});

test('les renvois vers une page de PDF ou une proposition numérotée restent des fragments de la source', () => {
  const ref = { sourceId: 'programme', locator: 'Chapitre 2' };
  for (const fragment of [undefined, 'page=1', 'proposition-255']) {
    assert.ok(sourceRefSchema.safeParse({ ...ref, fragment }).success);
  }
  for (const fragment of [
    'page=0',
    'page=10000',
    'https://example.com',
    'proposition-2&search=x',
  ]) {
    assert.equal(
      sourceRefSchema.safeParse({ ...ref, fragment }).success,
      false,
    );
  }
});

test('le graphique quotidien conserve les jours vides et distingue imports et révisions', () => {
  const rows = [
    { number: 1, observedOn: '2024-02-16' },
    { number: 1, observedOn: '2024-02-17' },
    { number: 2, observedOn: '2024-02-29' },
    { number: 3, observedOn: '2024-02-29' },
    { number: 1, observedOn: '2024-03-01' },
    { number: 1, observedOn: '2024-03-02' },
  ];
  const series = corpusActivity(rows, '2024-03-01');
  assert.equal(series.length, 14);
  assert.deepEqual(series[0], { date: '2024-02-17', added: 1, revised: 0 });
  assert.equal(series[1].added + series[1].revised, 0);
  assert.deepEqual(series.at(-2), { date: '2024-02-29', added: 0, revised: 2 });
  assert.deepEqual(series.at(-1), { date: '2024-03-01', added: 1, revised: 0 });
});
