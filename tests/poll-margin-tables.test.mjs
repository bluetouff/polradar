import test from 'node:test';
import assert from 'node:assert/strict';
import references from '../src/data/poll-margin-tables.json' with { type: 'json' };
import audits from '../src/data/poll-notice-audits.json' with { type: 'json' };

test('Les marges documentées sont en points et liées aux notices relues', () => {
  assert.equal(references.unit, 'point-de-pourcentage');
  assert.deepEqual(references.scores, [10, 20, 50]);
  for (const table of references.tables) {
    const url = new URL(table.url);
    assert.equal(url.origin, 'https://www.commission-des-sondages.fr');
    assert.match(url.pathname, new RegExp('/' + table.notice + '-.*\\.pdf$'));
    const audit = Object.values(audits).find((a) => a.number === table.notice);
    assert.equal(audit.sha256, table.sha256);
    assert.ok(Number.isInteger(table.page) && table.page > 0);
    assert.deepEqual(
      table.rows.map((row) => row.people),
      [...new Set(table.rows.map((row) => row.people))].sort((a, b) => a - b),
    );
    for (const { people, margins } of table.rows) {
      assert.ok(Number.isSafeInteger(people) && people > 0);
      assert.equal(margins.length, references.scores.length);
      assert.ok(margins.every((n) => Number.isFinite(n) && n > 0 && n <= 100));
    }
  }
  const ipsos = references.tables.find((t) => t.notice === '10195');
  assert.equal(ipsos.confidence, 95);
  assert.deepEqual(
    ipsos.rows.find((r) => r.people === 1079).margins,
    [1.8, 2.4, 3],
  );
  const cluster = references.tables.find((t) => t.notice === '10325');
  assert.equal(cluster.confidence, null);
  assert.deepEqual(
    cluster.rows.find((r) => r.people === 852).margins,
    [2, 2.7, 3.4],
  );
  const ifop = references.tables.find((t) => t.notice === '10392');
  assert.deepEqual(
    ifop.rows.find((r) => r.people === 600).margins,
    [2.4, 3.3, 4.1],
  );
});
