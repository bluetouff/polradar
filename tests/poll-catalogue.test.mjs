import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  catalogueCoverage,
  catalogueSchema,
  mergeCatalogue,
} from '../src/lib/poll-catalogue.mjs';
import { documentedSpecialStudies } from '../src/lib/poll-special-studies.mjs';
const read = (n) =>
  JSON.parse(
    readFileSync(
      new URL('../src/data/' + n + '.json', import.meta.url),
      'utf8',
    ),
  );
const snapshot = catalogueSchema.parse(read('poll-catalogue')),
  polls = read('polls'),
  sources = read('sources'),
  audits = read('poll-notice-audits');
test('Le baromètre Odoxa reste hors des intentions de vote, et une notice est entièrement importée seulement après relecture des pages', () => {
  const byNumber = (p) =>
    new Map(
      catalogueCoverage(snapshot, p, sources, audits).map((r) => [r.number, r]),
    );
  const all = byNumber(polls);
  assert.equal(all.get('10395').status, 'non_pertinente');
  assert.equal(all.get('10395').scenarios.length, 0);
  assert.equal(all.get('10392').status, 'integree');
  for (const id of ['10382', '10371', '10384'])
    assert.equal(all.get(id).status, 'integree');
  assert.equal(
    byNumber(
      polls.filter((p) => p.id !== 'yougov-2026-11-19-10382-second-2'),
    ).get('10382').status,
    'partielle',
  );
  assert.equal(
    byNumber(polls.filter((p) => p.id !== 'ifop-2026-11-20-10392-p8')).get(
      '10392',
    ).status,
    'partielle',
  );
  assert.equal(
    [...all.values()].flatMap((r) => r.scenarios).length,
    polls.length,
  );
});

test('Les enquêtes à périmètre particulier gardent leurs bases, leurs pages et leurs résultats hors des séries nationales', () => {
  const coverage = catalogueCoverage(snapshot, polls, sources, audits);
  const raw = read('poll-special-studies');
  const rows = documentedSpecialStudies(raw, coverage);
  const tableFor = (n, p) =>
    rows.find((s) => s.number === n).tables.find((t) => t.page === p);
  const white = tableFor('10292', 11);
  assert.equal(
    white.results.find((r) => r.label === 'Vote blanc').percentage,
    6,
  );
  assert.match(tableFor('10141', 9).base, /742/);
  assert.match(tableFor('10291', 26).base, /3\s030/);
  assert.equal(tableFor('10291', 26).results[0].percentage, 55);
  assert.equal(rows.find((s) => s.number === '10218').tables.length, 13);
  assert.ok(
    rows.every((s) => {
      const notice = coverage.find((r) => r.downloadId === s.downloadId);
      return notice.status === 'hors_series' && notice.scenarios.length === 0;
    }),
  );

  const [original, ...others] = raw;
  for (const invalid of [
    { ...original, number: '99999' },
    { ...original, methodPage: 1000 },
    { ...original, pdfUrl: 'https://example.org/notice.pdf' },
    {
      ...original,
      tables: [{ ...original.tables[0], questionPage: 1000 }],
    },
  ]) {
    assert.throws(() =>
      documentedSpecialStudies([invalid, ...others], coverage),
    );
  }
  const ordinaryPoll = polls.find((p) => p.id === 'ifop-2026-11-20-10392-p8');
  const ordinaryNotice = coverage.find((r) => r.number === '10392');
  assert.throws(() =>
    catalogueCoverage(snapshot, [ordinaryPoll], sources, {
      ...audits,
      [ordinaryNotice.downloadId]: {
        ...ordinaryNotice.audit,
        outsideSeries: true,
        pages: [],
        scenarios: [],
        evidencePages: [8],
      },
    }),
  );
});
test('Un échec conserve les notices et leur précédent succès ; les suppressions du catalogue sont visibles', () => {
  const when = new Date(
      Date.parse(snapshot.checkedAt) + 86_400_000,
    ).toISOString(),
    later = new Date(Date.parse(when) + 86_400_000).toISOString();
  const unavailable = mergeCatalogue(snapshot, {
    checkedAt: when,
    status: 'unavailable',
  });
  assert.deepEqual(unavailable.rows, snapshot.rows);
  assert.equal(unavailable.lastSuccessAt, snapshot.lastSuccessAt);
  assert.equal(unavailable.checkedAt, when);
  const { downloadId, number, label, listedMonth } = snapshot.rows[0];
  const ok = mergeCatalogue(unavailable, {
    checkedAt: later,
    status: 'available',
    catalogue: [{ downloadId, number, label, listedMonth }],
  });
  assert.equal(ok.rows.length, snapshot.rows.length);
  assert.equal(ok.rows.filter((r) => r.lastListedAt === later).length, 1);
  assert.throws(() =>
    mergeCatalogue(ok, { checkedAt: when, status: 'unavailable' }),
  );
  assert.throws(() =>
    mergeCatalogue(ok, {
      checkedAt: later,
      status: 'available',
      catalogue: [],
    }),
  );
  assert.throws(() =>
    mergeCatalogue(ok, {
      checkedAt: later,
      status: 'available',
      catalogue: [
        {
          downloadId: '../../test',
          number: null,
          label: 'Test',
          listedMonth: null,
        },
      ],
    }),
  );
});

test('Une tentative sans succès ne peut pas contenir des résultats antérieurs fictifs', () => {
  const noRecord = { ...snapshot, available: false, lastSuccessAt: null };
  assert.equal(catalogueSchema.safeParse(noRecord).success, false);
  assert.equal(
    catalogueSchema.safeParse({ ...noRecord, rows: [] }).success,
    true,
  );
  assert.equal(
    catalogueSchema.safeParse({ ...snapshot, lastSuccessAt: null }).success,
    false,
  );
  assert.equal(
    catalogueSchema.safeParse({ ...snapshot, rows: [], available: true })
      .success,
    false,
  );
});

test('Le rattrapage reste attaché à la notice et sa relecture survit aux passages suivants', () => {
  const when = new Date(
    Date.parse(snapshot.checkedAt) + 86_400_000,
  ).toISOString();
  const { downloadId, number, label, listedMonth } = snapshot.rows.find(
    (r) => r.number === '10333',
  );
  const row = { downloadId, number, label, listedMonth };
  const report = { checkedAt: when, status: 'available', catalogue: [row] };
  const entry = {
    downloadId,
    number,
    status: 'lecture-requise',
    sha256: 'a'.repeat(64),
  };
  const state = mergeCatalogue(snapshot, { ...report, backfill: [entry] });
  const later = mergeCatalogue(state, report);
  assert.deepEqual(
    later.rows.find((r) => r.downloadId === downloadId).backfill,
    { at: when, status: entry.status, sha256: entry.sha256 },
  );
  assert.equal(
    mergeCatalogue(state, {
      ...report,
      catalogue: [{ ...row, label: label + ' (modifiée)' }],
    }).rows.find((r) => r.downloadId === downloadId).backfill,
    undefined,
  );
  assert.throws(() =>
    mergeCatalogue(state, {
      ...report,
      backfill: [{ ...entry, sha256: undefined }],
    }),
  );
  assert.throws(() =>
    mergeCatalogue(state, { ...report, backfill: [entry, entry] }),
  );
  assert.throws(() =>
    mergeCatalogue(state, {
      ...report,
      backfill: [{ ...entry, number: '55555' }],
    }),
  );
  assert.throws(() =>
    mergeCatalogue(state, {
      ...report,
      backfill: [{ ...entry, downloadId: '999998' }],
    }),
  );
});
