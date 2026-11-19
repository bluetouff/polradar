import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chesFranceSchema } from '../src/lib/ches.mjs';
const rows = JSON.parse(
  readFileSync(
    new URL('../src/data/ches-france-2024.json', import.meta.url),
    'utf8',
  ),
);
test('le sous-ensemble français conserve les dix identifiants et les valeurs publiées sans arrondir', () => {
  const wave = chesFranceSchema.parse(rows);
  assert.deepEqual(
    wave.parties.map((p) => p.party_id),
    [601, 602, 605, 609, 610, 613, 626, 627, 630, 631],
  );
  const p = wave.parties.find((p) => p.party_id === 627);
  assert.deepEqual(
    [p.lrecon, p.galtan, p.eu_position],
    [0.90909094, 1.8181819, 3],
  );
  assert.equal(
    wave.sha256,
    '1c1ec0532afa2a0a13317122cbbe40eb9ff35425191892d1fff24fbef6acc6a8',
  );
});
test('les valeurs absentes ou hors échelle et les partis en double sont rejetés', () => {
  for (const [key, value] of [
    ['galtan', null],
    ['lrecon', 10.01],
    ['eu_position', 0],
    ['eu_position', 7.1],
  ]) {
    const data = structuredClone(rows);
    data.parties[0][key] = value;
    assert.equal(chesFranceSchema.safeParse(data).success, false);
  }
  const data = structuredClone(rows);
  data.parties.push(data.parties[0]);
  assert.equal(chesFranceSchema.safeParse(data).success, false);
});
