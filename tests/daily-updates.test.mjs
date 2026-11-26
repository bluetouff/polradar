import test from 'node:test';
import { collectionClock } from '../src/lib/collection-clock.mjs';
import { latestCollections } from '../src/lib/daily-updates.mjs';
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
      initialFingerprint: 'a'.repeat(64),
      message: 'diagnostic privé',
      httpStatus: 503,
    },
  ];
  const report = makeDailyReport(f);
  assert.deepEqual(report.sourceChecks, [
    {
      sourceId: 'campagne',
      status: 'indisponible',
      checkedAt: previous,
      initialFingerprint: 'a'.repeat(64),
    },
  ]);
  assert.equal(dailyHistorySchema.safeParse([report]).success, true);
  for (const invalid of [
    [report.sourceChecks[0], report.sourceChecks[0]],
    [{ ...report.sourceChecks[0], checkedAt: '2026-12-01T00:00:00Z' }],
    [{ ...report.sourceChecks[0], status: 'suppose' }],
    [{ ...report.sourceChecks[0], initialFingerprint: 'empreinte invalide' }],
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

test('un passage sondages récent laisse les cinq contrôles vieux de 48 heures en retard', () => {
  const now = Date.parse('2026-11-24T18:15:00Z');
  const old = '2026-11-22T18:15:00Z';
  const recent = '2026-11-24T17:58:00Z';
  const full = makeDailyReport(fixture());
  const night = {
    ...full,
    run: '741',
    at: recent,
    scope: 'sondages',
    sourceChecks: [],
    rows: [
      {
        ...full.rows[0],
        checked: recent,
        lastChange: null,
        lastSuccessAt: recent,
      },
    ],
  };
  const day = {
    ...full,
    at: old,
    sourceChecks: [],
    rows: full.rows.map((row) => ({
      ...row,
      checked: old,
      lastChange: null,
      lastSuccessAt: old,
    })),
  };
  const latest = latestCollections(dailyHistorySchema.parse([night, day]));
  assert.equal(latest.length, 6);
  for (const { row, attempted, succeeded } of latest) {
    const polls = row.id === 'sondages';
    assert.equal(attempted, polls ? recent : old);
    const timing = collectionClock(
      polls ? 'sondages' : 'quotidienne',
      attempted,
      succeeded,
      now,
    );
    assert.equal(timing.missedAttempt, !polls);
    assert.equal(timing.missedSuccess, !polls);
    assert.equal(timing.next, '2026-11-25T07:00:00.000Z');
  }

  const failed = {
    ...day,
    run: '742',
    at: '2026-11-24T07:30:00Z',
    rows: day.rows.map((row) => ({
      ...row,
      status: 'unavailable',
      checked: null,
      lastSuccessAt: old,
    })),
  };
  const current = latestCollections(dailyHistorySchema.parse([night, failed]));
  const economy = current.find(({ row }) => row.id === 'economie');
  assert.equal(economy.attempted, failed.at);
  assert.equal(economy.succeeded, old);
  assert.equal(economy.row.status, 'unavailable');
  const timing = collectionClock(
    'quotidienne',
    economy.attempted,
    economy.succeeded,
    now,
  );
  assert.equal(timing.missedAttempt, false);
  assert.equal(timing.missedSuccess, true);

  const staleReportedSuccess = {
    ...failed,
    rows: failed.rows.map((row) => ({
      ...row,
      lastSuccessAt: '2026-11-21T07:30:00Z',
    })),
  };
  const merged = latestCollections(
    dailyHistorySchema.parse([night, staleReportedSuccess, day]),
  );
  assert.equal(merged.find(({ row }) => row.id === 'economie').succeeded, old);
  assert.equal(
    merged.find(({ row }) => row.id === 'economie').row.status,
    'unavailable',
  );
});

test('le contrôle quotidien suit l’heure de Paris au changement d’heure et laisse deux heures au lancement', () => {
  const yesterday = '2026-03-28T07:20:00Z';
  const remaining = collectionClock(
    'quotidienne',
    yesterday,
    yesterday,
    Date.parse('2026-03-29T07:59:00Z'),
  );
  assert.equal(remaining.next, '2026-03-30T06:00:00.000Z');
  assert.equal(remaining.missedAttempt, false);
  assert.equal(remaining.state, 'dans-la-tolerance');
  assert.equal(remaining.evaluatedAt, '2026-03-29T07:59:00.000Z');
  assert.equal(remaining.graceEndsAt, '2026-03-29T08:00:00.000Z');
  assert.equal(remaining.requiredSince, '2026-03-28T07:00:00.000Z');
  const late = collectionClock(
    'quotidienne',
    yesterday,
    yesterday,
    Date.parse('2026-03-29T08:00:00Z'),
  );
  assert.equal(late.missedAttempt, true);
  assert.equal(late.state, 'tentative-en-retard');
  assert.equal(late.graceEndsAt, null);
  assert.equal(late.requiredSince, '2026-03-29T06:00:00.000Z');
  assert.equal(
    collectionClock(
      'sondages',
      yesterday,
      null,
      Date.parse('2026-10-25T16:42:00Z'),
    ).next,
    '2026-10-25T17:00:00.000Z',
  );
});
