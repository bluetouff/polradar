import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  csgExample,
  salaryGraphic,
  monthlyCsg2026,
  salaryCents,
} from '../src/lib/csg-paie.mjs';
import { updateCommuneIndex } from '../src/lib/communes.mjs';
const read = (id) =>
  JSON.parse(
    readFileSync(
      new URL('../src/data/territoires/' + id + '.json', import.meta.url),
    ),
  );
test('la paie distingue l’assiette, la CSG déductible et la part non déductible', () => {
  assert.deepEqual(csgExample(200000), {
    gross: 200000,
    base: 196500,
    deducted: 13362,
    other: 4716,
    total: 18078,
  });
  assert.equal(csgExample(300000).total, 27117);
  assert.equal(csgExample(400000).total, 36156);
  assert.equal(csgExample(0).total, 0);
  assert.doesNotThrow(() => csgExample(1602000));
  assert.throws(() => csgExample(1602001));
  assert.throws(() => csgExample(-1));
  assert.throws(() => csgExample(1.5));
  assert.ok(salaryGraphic().svg.includes('180,78'));
});
test('le salaire mensuel conserve les centimes et applique le plafond 2026 à la seule fraction concernée', () => {
  assert.equal(salaryCents('2 345,06'), 234506);
  assert.equal(salaryCents('0'), 0);
  for (const invalid of ['', '-1', '1e6', '2,345', '1 02', '7.00;1', '+-+-10'])
    assert.equal(salaryCents(invalid), null);
  assert.deepEqual(monthlyCsg2026(200000), csgExample(200000));
  assert.equal(monthlyCsg2026(1602000).base, 1573965);
  assert.equal(monthlyCsg2026(1602001).base, 1573966);
  assert.deepEqual(monthlyCsg2026(2000000), {
    gross: 2000000,
    base: 1971965,
    deducted: 134094,
    other: 47327,
    total: 181421,
  });
  assert.throws(() => monthlyCsg2026(Number.MAX_SAFE_INTEGER));
});
test('les éditions SRU et DREES conservent les bornes, les absences et les zéros observés', () => {
  const sru = read('sru'),
    apl = read('apl'),
    deps = read('departements');
  const baseline = JSON.parse(
    readFileSync(
      new URL('../public/data/communes/2022/index.json', import.meta.url),
    ),
  );
  const names = updateCommuneIndex(baseline, read('annuaire'));
  assert.equal(
    createHash('sha256')
      .update(JSON.stringify(names) + '\n')
      .digest('hex'),
    'bdb0c66963252d0ca26405c086aba2c8011a6be32575ba22ec258cc097ea45f1',
  );
  const index = new Set(names.map(([code]) => code));
  for (const code of [...Object.keys(sru), ...Object.keys(apl)])
    assert.ok(index.has(code), code);
  assert.equal(Object.keys(sru).length, 2206);
  assert.equal(Object.values(sru).filter((r) => r.inScope).length, 2203);
  assert.deepEqual(sru['75056'], {
    inventory: 276032,
    rate: '23,21%',
    target: 25,
    inScope: true,
    deficit: true,
    carence: false,
    exempt: false,
  });
  assert.equal(sru['59002'].rate, '>25%');
  assert.equal(sru['59002'].inventory, null);
  assert.equal(sru['97120'].rate, '121,87%');
  assert.equal(Object.keys(apl).length, 34893);
  assert.equal(apl['01019'], 0);
  assert.equal(apl['01001'], 1.953);
  assert.equal(apl['75056'], 5.497);
  assert.equal(apl['97611'], undefined);
  assert.equal(deps.find((d) => d.code === '976').value, null);
  assert.equal(deps.find((d) => d.code === '75').value, apl['75056']);
  assert.equal(deps.filter((d) => d.value !== null).length, 100);
});
