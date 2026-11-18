import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evolutionSchema,
  financingSchema,
  validateProposalReferences,
} from '../src/lib/proposal-evidence.mjs';
import {
  proposalComparison,
  financingLayout,
} from '../src/lib/proposal-view.mjs';
import { immutableHistoryErrors } from '../src/lib/history.mjs';
const data = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  );
const evolution = evolutionSchema.parse(data('proposal-evolution'));
const financing = financingSchema.parse(data('financing-maps'));
const budgets = data('programme-budgets');
const dataset = Object.fromEntries(
  ['sources', 'candidates', 'themes', 'measures'].map((n) => [n, data(n)]),
);
const valid = (e = evolution, f = financing, b = budgets) =>
  validateProposalReferences(
    e,
    f,
    dataset,
    b,
    new Date('2026-11-19T12:00:00Z'),
  );
test('les documents officiels datés et les relations financières sont qualifiés', () => {
  assert.deepEqual(valid(), []);
  assert.equal(evolution.states.length, 14);
  assert.equal(financing.maps.length, 16);
});
test('les revenus de 2022 ne deviennent pas un SMIC comparable et un âge maintenu reste une position de parti', () => {
  const track = evolution.tracks.find((t) => t.id === 'arthaud-revenus');
  const states = track.stateIds.map((id) =>
    evolution.states.find((s) => s.id === id),
  );
  assert.notEqual(states[0].basisKey, states[1].basisKey);
  assert.equal(proposalComparison(track, states[0], states[2]).delta, null);
  assert.equal(states[0].scope, 'archive');
  const current = evolution.states.find(
    (s) => s.id === 'roussel-retraites-juin-2026',
  );
  assert.equal(current.scope, 'parti');
  assert.equal(current.value, 60);
});
test('seules les mêmes bases autorisent une différence nominale, les conditions et périmètres restent distincts', () => {
  const from = evolution.states[0],
    to = evolution.states[2];
  assert.equal(proposalComparison(evolution.tracks[0], from, to).delta, 300);
  assert.equal(proposalComparison(evolution.tracks[0], to, from).delta, -300);
  assert.equal(proposalComparison(evolution.tracks[0], from, from).delta, null);
  for (const track of evolution.tracks.slice(1)) {
    const states = track.stateIds.map((id) =>
      evolution.states.find((s) => s.id === id),
    );
    assert.equal(proposalComparison(track, states[0], states[1]).delta, null);
  }
  assert.equal(
    proposalComparison(evolution.tracks[0], from, { ...to, basisKey: 'autre' })
      .delta,
    null,
  );
});
test('identités, sources, précision temporelle, domaines et bases incohérents bloquent la publication', () => {
  for (const mutate of [
    (d) => d.states.push(d.states[0]),
    (d) => d.tracks[0].stateIds.push('introuvable'),
    (d) => (d.states[0].source.url = 'https://example.org/document'),
    (d) => (d.states[0].source.authority = 'campagne'),
    (d) => (d.states[2].basisKey = 'smic-brut'),
    (d) => (d.states[0].date.kind = 'publication'),
    (d) => (d.states[2].recordedAt = '2026-11-17T12:00:00Z'),
    (d) => (d.states[2].observedOn = '2026-12-01'),
    (d) => (d.states[0].trackId = 'philippe-retraites'),
    (d) => (d.tracks[0].measureIds = ['philippe-retraites-1']),
  ]) {
    const copy = structuredClone(evolution);
    mutate(copy);
    assert.ok(valid(copy).length);
  }
  const copy = structuredClone(evolution);
  copy.states[0].value = Infinity;
  assert.equal(evolutionSchema.safeParse(copy).success, false);
});
test('une correction ne peut ni remplacer ni supprimer une capture déjà publiée', () => {
  const altered = structuredClone(evolution.states);
  altered[0].source.quote = 'autre texte';
  assert.ok(immutableHistoryErrors(evolution.states, altered).length);
  assert.ok(
    immutableHistoryErrors(evolution.states, evolution.states.slice(1)).length,
  );
  assert.deepEqual(
    immutableHistoryErrors(evolution.states, [
      ...evolution.states,
      { ...evolution.states[0], id: 'nouvelle-capture' },
    ]),
    [],
  );
});
test('les flux réconcilient leurs seuls montants, conservent les pourcentages et n’attribuent aucun montant inconnu', () => {
  for (const map of financing.maps) {
    const entry = budgets.profiles
      .flatMap((p) => p.entries)
      .find((e) => e.id === map.budgetEntry);
    const layout = financingLayout(map, entry);
    if (entry.allocation.length)
      assert.ok(
        Math.abs(layout.leaves.reduce((n, l) => n + l.band, 0) - 176) < 0.00001,
      );
    for (const leaf of layout.leaves) {
      assert.ok(leaf.x >= 0 && leaf.x + leaf.width <= layout.width);
      assert.ok(leaf.y >= 0 && leaf.y + leaf.height <= layout.height);
      assert.ok(leaf.band === null || leaf.band + 16 <= leaf.height);
      assert.doesNotMatch(leaf.path, /NaN|Infinity/);
    }
    if (map.relation === 'non-chiffree') {
      assert.equal(layout.leaves[0].value, null);
      assert.equal(layout.leaves[0].band, null);
      assert.ok(!layout.leaves[0].amount.includes('Md€'));
    }
    if (entry.allocationUnit === 'pourcentage')
      assert.deepEqual(
        layout.leaves.map((l) => l.amount),
        ['50 %', '25 %', '25 %'],
      );
  }
  const bad = structuredClone(financing);
  bad.maps[0].candidate = 'melenchon';
  assert.ok(valid(evolution, bad).length);
  const bad2 = structuredClone(financing);
  bad2.maps.find((m) => m.relation === 'non-chiffree').origin.qualifier = null;
  assert.ok(valid(evolution, bad2).length);
  const bad3 = structuredClone(financing);
  bad3.maps[0].assumptions = ['poste inexistant'];
  assert.ok(valid(evolution, bad3).length);
  // The map blueprint cannot silently introduce an independent second monetary source.
  const bad4 = structuredClone(financing);
  bad4.maps[0].euros = 1;
  assert.equal(financingSchema.safeParse(bad4).success, false);
});
