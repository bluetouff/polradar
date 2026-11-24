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

test('chaque contrôle public garde uniquement le document, le statut et son heure effective', () => {
  const f = fixture();
  f.watch = [
    {
      sourceId: 'campagne',
      status: 'indisponible',
      checkedAt: previous,
      message: 'diagnostic privé',
      httpStatus: 503,
    },
  ];
  const report = makeDailyReport(f);
  assert.deepEqual(report.sourceChecks, [
    { sourceId: 'campagne', status: 'indisponible', checkedAt: previous },
  ]);
  assert.equal(dailyHistorySchema.safeParse([report]).success, true);
  for (const invalid of [
    [report.sourceChecks[0], report.sourceChecks[0]],
    [{ ...report.sourceChecks[0], checkedAt: '2026-12-01T00:00:00Z' }],
    [{ ...report.sourceChecks[0], status: 'suppose' }],
  ])
    assert.equal(
      dailyHistorySchema.safeParse([{ ...report, sourceChecks: invalid }])
        .success,
      false,
    );
  const old = { ...report };
  delete old.sourceChecks;
  assert.equal(dailyHistorySchema.safeParse([old]).success, true);
});

test('le passage du soir date uniquement les sondages et conserve les relevés des autres familles', () => {
  const f = fixture();
  f.pollsOnly = true;
  Object.assign(f.polls, { checkedAt: at });
  const report = makeDailyReport(f);
  assert.deepEqual(
    report.rows.map((r) => r.id),
    ['sondages'],
  );
  assert.equal(report.rows[0].checked, at);
  assert.equal(report.scope, 'sondages');
  assert.equal(dailyHistorySchema.safeParse([report]).success, true);
  assert.equal(
    dailyHistorySchema.safeParse([{ ...report, scope: undefined }]).success,
    false,
  );
  assert.equal(
    dailyHistorySchema.safeParse([{ ...report, rows: [] }]).success,
    false,
  );
  f.pollsOnly = false;
  f.history = [
    { ...report, run: '10' },
    { run: '9', attempt: 1, rows: [{ id: 'economie', lastChange: previous }] },
  ];
  assert.equal(
    makeDailyReport(f).rows.find((r) => r.id === 'economie').lastChange,
    previous,
  );
});
