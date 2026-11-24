import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  electricityComparison,
  electricityPolicies,
  electricityProfiles,
  maxAnnualKwh,
} from '../src/lib/electricity-tax.mjs';

test('les profils CRE utilisent le tarif publié pour leur puissance', () => {
  const base6 = electricityComparison(6, 2200);
  assert.equal(base6.current, 44022);
  assert.deepEqual(
    base6.alternatives.map((p) => p.amount),
    [39117, 36685, 38703],
  );
  const base9 = electricityComparison(9, 4000);
  assert.equal(base9.current, 79400);
  assert.deepEqual(
    base9.alternatives.map((p) => p.amount),
    [70482, 66167, 69806],
  );
});
test('chaque mesure remplace une taxe une seule fois sur la même base', () => {
  const result = electricityComparison(6, 5000);
  // Accise 30.62 -> 12.04 EUR/MWh, 5 MWh and VAT at 20%.
  assert.equal(result.alternatives[0].difference, 11148);
  // VAT suppressed on 1 000.50 EUR TTC, leaving the existing excise in place.
  assert.equal(result.alternatives[1].amount, 83375);
  // VAT at 5.5% on that same base. This row doesn't include the excise cut.
  assert.equal(result.alternatives[2].amount, 87961);
  for (const change of result.alternatives)
    assert.equal(change.difference, result.current - change.amount);
});
test('aucun abonnement ni substitution d’une valeur absente', () => {
  for (const profile of electricityProfiles) {
    assert.equal(electricityComparison(profile.kva, 0).current, 0);
    assert.ok(
      electricityComparison(profile.kva, 0).alternatives.every(
        (a) => a.amount === 0,
      ),
    );
    assert.ok(electricityComparison(profile.kva, maxAnnualKwh));
  }
  for (const n of [
    null,
    undefined,
    NaN,
    -1,
    1.2,
    '12',
    Infinity,
    maxAnnualKwh + 1,
  ])
    assert.equal(electricityComparison(6, n), null);
  assert.equal(electricityComparison(3, 2200), null);
});
test('les trois signatures renvoient à la fiche et à son document source', () => {
  const rows = JSON.parse(
    readFileSync(new URL('../src/data/measures.json', import.meta.url)),
  );
  for (const p of electricityPolicies) {
    const record = rows.find((r) => r.id === p.measure);
    assert.ok(
      record.sourceRefs.some((s) => s.sourceId === p.source),
      p.measure,
    );
  }
});
