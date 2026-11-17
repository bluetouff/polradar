import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  marketSnapshotSchema,
  marketMidpoint,
  marketPercent,
  rankedContracts,
} from '../src/lib/markets.mjs';
const snapshot = JSON.parse(
  readFileSync(
    new URL('../src/data/prediction-markets.json', import.meta.url),
    'utf8',
  ),
);

test('le relevé conserve deux plateformes, leurs horodatages et des unités distinctes', () => {
  const data = marketSnapshotSchema.parse(snapshot);
  assert.equal(new Set(data.providers.map((p) => p.id)).size, 2);
  assert.equal(
    data.providers.find((p) => p.id === 'kalshi').volumeUnit,
    'contrats',
  );
  assert.equal(
    data.providers.find((p) => p.id === 'polymarket').volumeUnit,
    'dollars',
  );
});
test('les carnets incomplets restent inconnus et les petites valeurs restent lisibles', () => {
  assert.equal(marketMidpoint({ bid: null, ask: 0.6 }), null);
  assert.equal(marketMidpoint({ bid: 0.34, ask: 0.36 }), 0.35);
  assert.equal(marketPercent(null), 'Indisponible');
  assert.equal(marketPercent(0.00001), '< 0,01 %');
  const input = [
    { label: 'Inconnu', bid: null, ask: null },
    { label: 'A', bid: 0.2, ask: 0.3 },
    { label: 'B', bid: 0.4, ask: 0.5 },
  ];
  assert.deepEqual(
    rankedContracts(input).map((r) => r.label),
    ['B', 'A', 'Inconnu'],
  );
  assert.equal(input[0].label, 'Inconnu');
});
test('les flux, les unités, les dates et les bornes sont contrôlés', () => {
  for (const mutate of [
    (d) => {
      d.providers[0].apiUrl = 'https://example.org/';
    },
    (d) => {
      d.providers[0].url = 'javascript:alert(1)';
    },
    (d) => {
      d.providers[0].volumeUnit = 'contrats';
    },
    (d) => {
      d.providers[0].contracts[0].bid = 0.9;
      d.providers[0].contracts[0].ask = 0.8;
    },
    (d) => {
      d.providers[0].contracts[0].bid = 0;
    },
    (d) => {
      d.providers[0].contracts[0].ask = 1;
    },
    (d) => {
      d.providers[0].contracts[0].updatedAt = '2099-01-01T00:00:00Z';
    },
    (d) => {
      d.providers[0].observedAt = '2099-01-01T00:00:00Z';
    },
    (d) => {
      d.providers[0].contracts.push(d.providers[0].contracts[0]);
    },
    (d) => {
      d.providers[0].status = 'unavailable';
    },
  ]) {
    const data = structuredClone(snapshot);
    mutate(data);
    assert.equal(marketSnapshotSchema.safeParse(data).success, false);
  }
  const data = structuredClone(snapshot);
  const p = data.providers[0];
  p.status = 'unavailable';
  p.error = 'source-unavailable-or-invalid';
  p.contracts = [];
  p.volume = null;
  assert.equal(marketSnapshotSchema.safeParse(data).success, true);
});
