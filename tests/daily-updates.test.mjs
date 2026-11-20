import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDailyReport } from '../scripts/daily-report.mjs';
import { dailyHistorySchema } from '../src/lib/daily-updates.mjs';

const at = '2026-11-20T05:42:00Z',
  previous = '2026-11-19T05:40:00Z';
function fixture() {
  const markets = {
    providers: ['polymarket', 'kalshi'].map((id) => ({
      id,
      status: 'available',
      observedAt: previous,
      contracts: [
        { id: 'a', label: 'Contrat A', bid: 0.42, updatedAt: previous },
      ],
    })),
  };
  const economy = {
    series: [
      {
        id: 'series',
        updatedAt: previous,
        observations: [
          ['2026-09', 7, 'p'],
          ['2026-10', 8, ''],
        ],
      },
    ],
  };
  const after = {
    sources: [],
    polls: [],
    markets,
    economy,
    airtime: { months: [{ month: '2026-09', sha256: 'snapshot' }] },
  };
  return {
    run: '12',
    attempt: 1,
    at,
    history: [],
    before: structuredClone(after),
    after,
    polls: { checked: at.slice(0, 10), status: 'available', review: [] },
    markets,
    economy,
    economyReview: { checked: at },
    airtime: { checked: at },
    watch: [{ sourceId: 'campaign', checkedAt: at, status: 'accessible' }],
    config: [{ id: 'series', title: 'Indicateur' }],
    sources: [],
  };
}
test('la date de collecte ne crée pas un changement et une révision passée reste visible', () => {
  const f = fixture();
  f.after.markets.providers[0].observedAt = at;
  f.after.markets.providers[0].contracts[0].updatedAt = at;
  f.after.economy.series[0].observations[0][2] = '';
  f.after.sources.push({
    id: 'document-editorial',
    title: 'Document sans rapport avec une enquête',
  });
  const report = makeDailyReport(f);
  assert.deepEqual(dailyHistorySchema.parse([report]), [report]);
  const row = (id) => report.rows.find((r) => r.id === id);
  assert.deepEqual(row('polymarket').changes, []);
  assert.deepEqual(row('sondages').changes, []);
  assert.deepEqual(row('economie').changes, ['Indicateur · 2026-09']);
  assert.deepEqual(row('economie').periods, ['Indicateur · 2026-10']);
  f.after.markets.providers[0].contracts[0].bid = 0.53;
  assert.equal(
    makeDailyReport(f).rows.find((r) => r.id === 'polymarket').changes.length,
    1,
  );
});
test('le journal conserve le dernier changement, les indisponibilités et les documents à relire', () => {
  const f = fixture();
  f.history = [
    { run: '11', attempt: 1, rows: [{ id: 'economie', lastChange: previous }] },
  ];
  f.economy = null;
  f.economyReview.failed = ['series'];
  f.after.markets.providers[0].status = 'unavailable';
  f.after.markets.providers[0].contracts = [];
  f.watch = [
    { sourceId: 'campaign', checkedAt: at, status: 'modifie' },
    { sourceId: 'autre', checkedAt: at, status: 'bloque' },
  ];
  f.airtime = { checked: at, unavailableYears: [2026] };
  f.polls.review = [{ number: 101 }];
  const report = makeDailyReport(f);
  const row = (id) => report.rows.find((r) => r.id === id);
  assert.equal(row('economie').status, 'unavailable');
  assert.equal(row('economie').lastChange, previous);
  assert.equal(row('polymarket').status, 'unavailable');
  assert.equal(row('polymarket').dataDate, null);
  assert.equal(row('arcom').status, 'partial');
  assert.equal(row('veille').status, 'partial');
  assert.deepEqual(row('veille').changes, []);
  assert.deepEqual(row('veille').review, ['campaign']);
  assert.deepEqual(row('sondages').review, ['Notice 101 à relire']);
  assert.deepEqual(row('sondages').changes, []);
  assert.equal(dailyHistorySchema.safeParse([report, report]).success, false);
});
