import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceFreshness } from '../src/lib/daily-updates.mjs';
const success = '2026-11-20T12:00:00Z',
  failure = '2026-11-24T08:00:00+01:00';
test('Les erreurs successives ne rafraîchissent pas le dernier accès réussi', () => {
  const records = [
    { sourceId: 'a', status: 'modifie', checkedAt: success },
    { sourceId: 'a', status: 'bloque', checkedAt: failure },
    { sourceId: 'b', status: 'indisponible', checkedAt: failure },
    {
      sourceId: 'c',
      status: 'indisponible',
      checkedAt: failure,
      lastSuccessAt: success,
    },
  ];
  const result = sourceFreshness(records.reverse());
  assert.equal(result.get('a').lastSuccessAt, success);
  assert.equal(result.get('a').checkedAt, failure);
  assert.equal(result.get('b').lastSuccessAt, null);
  assert.equal(result.get('c').lastSuccessAt, success);
});
