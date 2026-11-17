import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  dateSchema,
  publicUrlSchema,
  validateDataset,
} from '../src/lib/schema.mjs';
const names = [
  'candidates',
  'themes',
  'sources',
  'engagements',
  'events',
  'polls',
  'budget',
  'meta',
];
const original = Object.fromEntries(
  names.map((name) => [
    name,
    JSON.parse(
      readFileSync(
        new URL(`../src/data/${name}.json`, import.meta.url),
        'utf8',
      ),
    ),
  ]),
);
const changed = (fn) => {
  const copy = structuredClone(original);
  fn(copy);
  return validateDataset(copy);
};

test('le corpus livré passe les contrôles', () =>
  assert.deepEqual(validateDataset(original), []));
test('les dates civiles impossibles sont refusées', () => {
  for (const value of ['2025-02-29', '2026-13-01', '2026-11-31', 'demain'])
    assert.equal(dateSchema.safeParse(value).success, false);
  assert.equal(dateSchema.safeParse('2024-02-29').success, true);
});
test('les URL actives, locales et authentifiées sont refusées', () => {
  for (const value of [
    'javascript:alert(1)',
    'http://example.org/',
    'https://user:secret@example.org/',
    'https://127.0.0.1/',
    'https://app.local/',
    'https://localhost./',
    'https://app.internal./',
    'https://example.org/\nheader',
    'https://example.org\\@localhost/',
    'https://[::1]/',
    'https://example.org:8443/',
  ])
    assert.equal(publicUrlSchema.safeParse(value).success, false);
  assert.equal(
    publicUrlSchema.safeParse('https://www.insee.fr/fr/statistiques').success,
    true,
  );
});
test('une référence cassée et un doublon bloquent la publication', () => {
  assert.ok(changed((d) => d.engagements[0].sources.push('inconnue')).length);
  assert.ok(changed((d) => d.candidates.push(d.candidates[0])).length);
});
test('une archive ne perd pas son millésime', () => {
  assert.ok(
    changed((d) => {
      const item = d.engagements.find((e) => e.scope === 'archive');
      item.edition = 'Campagne actuelle';
    }).length,
  );
});
test('les unités et la cohérence des comptes sont contrôlées', () => {
  assert.ok(
    changed((d) => {
      d.budget.unit = 'milliards';
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.budget.values.revenue = 2;
    }).length,
  );
});
test('les mises à jour conservent des dates et des exercices annuels cohérents', () => {
  assert.ok(
    changed((d) => {
      d.meta.corpusUpdated = '2099-01-01';
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.budget.year = new Date().getUTCFullYear();
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.budget.published = '2026-02-31';
    }).length,
  );
});
test('une enquête incohérente est refusée', () => {
  assert.ok(
    changed((d) =>
      d.polls.push({
        id: 'test',
        institute: 'Institut',
        commissioner: 'Commanditaire',
        published: '2026-11-01',
        fieldworkStart: '2026-11-02',
        fieldworkEnd: '2026-11-03',
        sampleSize: 1000,
        usefulSample: 2000,
        scenario: 'Scénario',
        noticeSource: 'sondages',
        results: [
          { name: 'A', percentage: 70 },
          { name: 'B', percentage: 50 },
        ],
        uncertainty: 'À documenter',
      }),
    ).length,
  );
});
