import test from 'node:test';
import assert from 'node:assert/strict';
import { countCoverage } from '../src/lib/coverage-matrix.ts';
const rows = [
  {
    id: 'a',
    candidate: 'a',
    theme: 'justice',
    scope: 'parti',
    edition: 'Projet 2026',
    documents: ['source', 'source'],
    topics: ['numerique', 'justice'],
  },
  {
    id: 'b',
    candidate: 'b',
    theme: 'justice',
    scope: 'archive',
    edition: '2022',
    documents: ['source'],
    topics: [],
  },
];
test('Un document et une mesure gardent des unités distinctes malgré plusieurs axes, thèmes et citations', () => {
  assert.deepEqual({ ...countCoverage(rows).byTheme }, { justice: 2 });
  assert.equal(countCoverage(rows).documents, 1);
  assert.equal(countCoverage(rows).candidates, 2);
  assert.equal(
    countCoverage(rows, {
      topic: 'justice',
      edition: 'Projet 2026',
      candidate: 'a',
      theme: 'justice',
      scope: 'parti',
    }).measures,
    1,
  );
  assert.equal(
    countCoverage(rows, { topic: 'sans-classement', scope: 'archive' })
      .measures,
    1,
  );
  assert.equal(
    countCoverage(rows, { topic: 'numerique', scope: 'archive' }).measures,
    0,
  );
  assert.throws(() => countCoverage([rows[0], rows[0]]), /double/);
});
