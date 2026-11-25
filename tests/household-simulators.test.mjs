import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import measures from '../src/data/measures.json' with { type: 'json' };
import {
  evaluateHousehold,
  householdSimulators,
} from '../src/lib/household-simulators.mjs';

const example = (simulator) =>
  Object.fromEntries(simulator.fields.map(({ id, value }) => [id, value]));

test('chaque exemple affiche une référence et une valeur par proposition', () => {
  for (const simulator of householdSimulators) {
    const result = evaluateHousehold(simulator.id, example(simulator));
    assert.equal(result.amounts.length, simulator.alternatives.length + 1);
    assert.ok(
      result.amounts.every(
        (value) =>
          value === null ||
          typeof value === 'boolean' ||
          Number.isFinite(value),
      ),
      simulator.id,
    );
  }
});

test('les calculs et les propositions complémentaires renvoient à des fiches sourcées distinctes', () => {
  const byId = new Map(measures.map((measure) => [measure.id, measure]));
  for (const simulator of householdSimulators) {
    const ids = [...simulator.alternatives, ...(simulator.positions ?? [])]
      .filter((row) => 'measure' in row)
      .map((row) => row.measure);
    assert.equal(new Set(ids).size, ids.length, simulator.id);
    for (const id of ids) {
      assert.ok(byId.get(id)?.sourceRefs.length, id);
      assert.notEqual(byId.get(id)?.scope, 'archive', id);
    }
  }
});

test('le barème en ligne directe reproduit l’exemple officiel avant arrondi', () => {
  const calculate = (share) =>
    evaluateHousehold('successions', { share }).amounts;
  assert.deepEqual(calculate('150 000'), [819435, 0, null, 0]);
  assert.equal(calculate('100000')[0], 0);
  assert.equal(calculate('100001')[0], 5);
  assert.equal(calculate('108072')[0], 40360);
  assert.equal(calculate('108073')[0], 40370);
  assert.equal(calculate('115932')[0], 138075);
  assert.equal(calculate('115933')[0], 138095);
});

test('la révision du loyer reproduit le cas publié sans mélanger les scénarios', () => {
  assert.deepEqual(
    evaluateHousehold('loyers', {
      rent: '600',
      previous: '146,68',
      next: '148.37',
    }).amounts,
    [60691, 42000, 60000, 60000],
  );
  assert.deepEqual(
    evaluateHousehold('loyers', { rent: '600', previous: '0', next: '148,37' }),
    { invalid: 'previous' },
  );
});

test('le carburant compare séparément la remise et la TVA à prix hors taxe constant', () => {
  assert.deepEqual(
    evaluateHousehold('carburants', { litres: '40', price: '1,9514' }).amounts,
    [7806, 6206, 6206, 6862, 7806],
  );
  assert.deepEqual(
    evaluateHousehold('carburants', { litres: '1', price: '0,40' }).amounts,
    [40, 0, 0, 35, 175],
  );
  assert.equal(
    evaluateHousehold('carburants', { litres: '40', price: '2,51' }).amounts.at(
      -1,
    ),
    10000,
  );
  assert.deepEqual(
    evaluateHousehold('carburants', { litres: '0', price: '1,9514' }).amounts,
    [0, 0, 0, 0, 0],
  );
});

test('le minimum salarial et les durées varient avec la période choisie', () => {
  assert.deepEqual(
    evaluateHousehold('temps-de-travail', { weeks: '2' }).amounts,
    [70, 78, 80, 56, 78],
  );
  assert.deepEqual(
    evaluateHousehold('smic', { months: '2' }).amounts,
    [295586, 440000, 300000, 320000, 400000, 340000, 338000, 340000],
  );
});

test('les allocations modélisent les critères de chaque texte', () => {
  const calculate = (children, nationality) =>
    evaluateHousehold('allocations-familiales', { children, nationality })
      .amounts;
  assert.deepEqual(calculate('0', '2'), [
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  assert.deepEqual(calculate('1', '2'), [false, true, true, true, false, true]);
  assert.deepEqual(calculate('2', '0'), [true, true, true, true, false, false]);
  assert.deepEqual(calculate('2', '1'), [true, true, true, true, true, false]);
});

test('une valeur absente, imprécise ou hors limites n’affiche aucun résultat', () => {
  for (const weeks of [undefined, '0', '53', '1,5', 'Infinity', {}, '1e1']) {
    assert.deepEqual(evaluateHousehold('temps-de-travail', { weeks }), {
      invalid: 'weeks',
    });
  }
  assert.deepEqual(
    evaluateHousehold('carburants', { litres: '40', price: '1,95142' }),
    { invalid: 'price' },
  );
  assert.deepEqual(
    evaluateHousehold('allocations-familiales', {
      children: '2',
      nationality: '3',
    }),
    { invalid: 'nationality' },
  );
  assert.equal(evaluateHousehold('hors-corpus', {}), null);
});
