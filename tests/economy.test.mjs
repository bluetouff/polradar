import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  economyCurve,
  economySchema,
  seriesConfigSchema,
  statementsSchema,
  validateEconomy,
  statementResult,
  decimalDifference,
} from '../src/lib/economy.mjs';

const load = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  );
const definitions = seriesConfigSchema.parse(load('economy-series'));
const snapshot = economySchema.parse(load('economy'));
const statements = statementsSchema.parse(load('economic-statements'));

test('les séries publiques ont une définition unique et aucune période postérieure à la collecte', () => {
  assert.deepEqual(validateEconomy(definitions, snapshot, statements), []);
  const changed = structuredClone(snapshot);
  changed.series[0].observations.push(['2099-01', '0', '']);
  assert.ok(
    validateEconomy(definitions, changed, statements).some((error) =>
      /hors champ/.test(error),
    ),
  );
  const missing = structuredClone(snapshot);
  missing.series.pop();
  assert.ok(
    validateEconomy(definitions, missing, statements).some((error) =>
      /incomplet/.test(error),
    ),
  );
});

test('la courbe conserve les lacunes et les zéros observés', () => {
  const chart = economyCurve(
    [
      ['2026-01', '1.2', 'p'],
      ['2026-02', '0.0', ''],
      ['2026-03', null, ''],
      ['2026-04', '-1', ''],
      ['2026-06', '0.3', 'e'],
    ],
    'M',
    400,
    140,
  );
  assert.deepEqual(
    chart.segments.map((points) => points.map((point) => point.value)),
    [['1.2', '0.0'], ['-1'], ['0.3']],
  );
  assert.ok(chart.zero > 0);
  assert.equal(chart.latest.flag, 'e');
});

test('l’arrondi respecte la précision annoncée et les demi-unités de chaque signe', () => {
  for (const [claimed, observed] of [
    ['10', '9.8'],
    ['1.3', '1.25'],
    ['-1.3', '-1.25'],
    ['0', '-0.4'],
  ]) {
    assert.equal(
      statementResult({ assessment: 'arrondi', claimed, observed }).label,
      'Concorde à l’arrondi',
    );
  }
  const invalid = {
    ...statements.find((row) => row.assessment === 'arrondi'),
    claimed: '1.2',
    observed: '1.25',
  };
  assert.ok(
    validateEconomy(definitions, snapshot, [invalid]).some((error) =>
      error.includes(invalid.id),
    ),
  );
});

test('les écarts décimaux se calculent à précision égale et seulement sur un périmètre comparable', () => {
  assert.equal(decimalDifference('115.6', '115.7'), '-0.1');
  assert.equal(decimalDifference('-0.2', '0.09'), '-0.29');
  assert.equal(
    statementResult({ assessment: 'perimetre', claimed: '1', observed: '2' })
      .delta,
    null,
  );
  assert.equal(
    statementResult({
      assessment: 'comparable',
      claimed: '5.10',
      observed: '5.1',
    }).tone,
    'match',
  );
  assert.equal(
    statementResult({
      assessment: 'comparable',
      claimed: '5.3',
      observed: '5.1',
    }).tone,
    'gap',
  );
  assert.equal(
    statements.find((row) => row.id === 'mercier-dette-2025').priorReference
      .date,
    '2026-03-27',
  );
});
