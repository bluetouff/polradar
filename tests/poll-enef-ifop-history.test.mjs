import test from 'node:test';
import assert from 'node:assert/strict';
import polls from '../src/data/polls.json' with { type: 'json' };
import sources from '../src/data/sources.json' with { type: 'json' };
import catalogue from '../src/data/poll-catalogue.json' with { type: 'json' };
import audits from '../src/data/poll-notice-audits.json' with { type: 'json' };
import publications from '../src/data/poll-first-publications.json' with { type: 'json' };
import documents from '../src/data/poll-publication-documents.json' with { type: 'json' };
import { catalogueCoverage } from '../src/lib/poll-catalogue.mjs';
import { withFirstPublications } from '../src/lib/poll-first-publications.mjs';

const batches = [
  ['10262', 'ipsos-bva-enef-2026-09-03', [22, 26, 30, 34, 38, 42]],
  [
    '10284',
    'ifop-fiducial-2026-09-25',
    Array.from({ length: 10 }, (_, i) => 9 + i),
  ],
  [
    '10327',
    'ifop-fiducial-2026-10-17',
    Array.from({ length: 13 }, (_, i) => 9 + i),
  ],
];
const survey = (id) => polls.filter((poll) => poll.surveyId === id);

test('Les trois notices historiques sont dépouillées et chaque hypothèse renvoie à son tableau', () => {
  const coverage = catalogueCoverage(catalogue, polls, sources, audits);
  for (const [number, surveyId, pages] of batches) {
    const rows = survey(surveyId);
    const entry = coverage.find((notice) => notice.number === number);
    assert.equal(entry.status, 'integree');
    assert.deepEqual(entry.audit.pages, pages);
    assert.deepEqual(
      rows.map((p) => p.noticePage),
      pages,
    );
    for (const row of rows) {
      assert.equal(row.question.status, 'verifiee');
      assert.equal(row.question.sourceId, row.noticeSource);
      assert.equal(row.question.page, row.noticePage);
      assert.equal(row.historicalImport, true);
    }
  }
});

test('L’Enquête électorale française conserve les six effectifs exprimés et les pages du rapport Ipsos', () => {
  const rows = survey('ipsos-bva-enef-2026-09-03');
  assert.deepEqual(
    rows.map((p) => p.usefulSample),
    [9445, 9327, 9233, 9290, 9142, 8984],
  );
  assert.deepEqual(
    rows.map((p) => p.resultPage),
    [18, 22, 26, 30, 34, 38],
  );
  assert.deepEqual(
    rows.map((p) => p.noIntention),
    [8, 9, 10, 9, 11, 12],
  );
  assert.ok(
    rows.every((p) => p.round === 'premier' && p.registeredSample === 13060),
  );
  assert.equal(
    rows[0].results.find((r) => r.id === 'glucksmann').percentage,
    11.5,
  );
  assert.equal(
    rows[5].results.find((r) => r.id === 'sonde-olivier-faure').percentage,
    5.5,
  );
  assert.ok(rows[5].results.every((r) => r.id !== 'philippe'));
});

test('Les baromètres Ifop distinguent le second tour et les cellules de non-expression vides', () => {
  const september = survey('ifop-fiducial-2026-09-25');
  assert.ok(
    september.every(
      (p) => p.round === 'premier' && p.registeredSample === 1393,
    ),
  );
  assert.equal(
    september[6].results.find((r) => r.id === 'sonde-jerome-guedj').percentage,
    3,
  );
  assert.equal(
    september[7].results.find((r) => r.id === 'sonde-emmanuel-maurel')
      .percentage,
    1,
  );
  const october = survey('ifop-fiducial-2026-10-17');
  assert.deepEqual(
    october.slice(0, 2).map((p) => p.noIntention),
    [25.8, 26.3],
  );
  assert.ok(october.slice(2).every((p) => p.noIntention === null));
  const duels = october.filter((p) => p.round === 'second');
  assert.equal(duels.length, 5);
  assert.deepEqual(
    duels.map((p) => p.results.find((r) => r.id === 'lepen').percentage),
    [68, 57, 59, 58, 56],
  );
  assert.equal(duels[0].usefulSample, 1240);
  assert.match(
    duels[0].uncertainty,
    /981 chez les personnes certaines d’aller voter/,
  );
});

test('Une date d’article et une heure annoncée restent distinctes de la première diffusion', () => {
  const documented = withFirstPublications(
    polls,
    publications,
    sources,
    '2026-11-24',
    documents,
  );
  const row = documented.find(
    (p) => p.surveyId === 'ipsos-bva-enef-2026-09-03',
  );
  assert.equal(row.firstPublication.status, 'inconnue');
  const [announced, article] = row.publicationDocuments;
  assert.equal(announced.kind, 'horaire-annonce');
  assert.equal(announced.localTime, '19:00');
  assert.match(announced.url, /#page=2$/);
  assert.equal(article.kind, 'article');
  assert.equal(article.publisher, 'Le Monde');
  assert.equal(article.localTime, '19:00');
  for (const [, id] of batches.slice(1)) {
    const ifop = documented.find((p) => p.surveyId === id);
    assert.equal(ifop.firstPublication.status, 'inconnue');
    assert.ok(ifop.publicationDocuments.length > 0);
  }
});
