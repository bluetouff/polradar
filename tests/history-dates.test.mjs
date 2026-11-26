import assert from 'node:assert/strict';
import test from 'node:test';
import {
  recordedVersionAt,
  validHistoryDate,
} from '../src/lib/history-dates.mjs';

test('la comparaison utilise l’enregistrement à la fin du jour parisien', () => {
  const versions = [
    { number: 1, observedOn: '2026-11-16', recordedAt: null },
    { number: 2, observedOn: '2026-11-16', recordedAt: '2026-11-26T23:30:00Z' },
    {
      number: 3,
      observedOn: '2026-11-16',
      recordedAt: '2026-11-27T01:00:00+01:00',
    },
  ];
  assert.equal(recordedVersionAt(versions, '2026-11-16'), null);
  assert.equal(recordedVersionAt(versions, '2026-11-26'), null);
  assert.equal(recordedVersionAt(versions, '2026-11-27'), versions[2]);
});

test('une date impossible ou un enregistrement inconnu ne sélectionnent aucune version', () => {
  const versions = [{ number: 1, recordedAt: null }];
  for (const day of ['', '2026-11-31', '2026-02-29', '2026-9-1', '0000-04-01'])
    assert.equal(validHistoryDate(day), false);
  assert.equal(validHistoryDate('2028-02-29'), true);
  assert.equal(recordedVersionAt(versions, '2026-11-26'), null);
});
