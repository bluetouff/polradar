import test from 'node:test';
import assert from 'node:assert/strict';
import polls from '../src/data/polls.json' with { type: 'json' };
import sources from '../src/data/sources.json' with { type: 'json' };
import evidence from '../src/data/poll-first-publications.json' with { type: 'json' };
import documents from '../src/data/poll-publication-documents.json' with { type: 'json' };
import { withFirstPublications } from '../src/lib/poll-first-publications.mjs';
import { pollGraphic } from '../src/lib/poll-graphic.mjs';

const today = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris',
}).format(new Date());
const annotated = withFirstPublications(
  polls,
  evidence,
  sources,
  today,
  documents,
);
test('les scénarios de chaque vague reprennent la déclaration de première diffusion de la notice', () => {
  for (const [survey, entry] of Object.entries(evidence)) {
    const rows = annotated.filter((p) => p.surveyId === survey);
    assert.ok(rows.length >= 1);
    for (const row of rows) {
      assert.equal(row.firstPublication.media, entry.media);
      assert.equal(row.firstPublication.date, entry.date);
      assert.equal(row.firstPublication.status, 'verifiee');
      assert.equal(
        new URL(row.firstPublication.sourceUrl).hash,
        '#page=' + entry.page,
      );
    }
  }
  const odoxa = annotated.find((p) => p.surveyId === 'odoxa-2026-09-24');
  assert.equal(odoxa.firstPublication.media, 'odoxa.fr');
  assert.ok(
    odoxa.firstPublication.sourceUrl.endsWith(
      '10310-pres-iv-odoxa-14-octobre.pdf#page=1',
    ),
  );
  const withoutEvidence = withFirstPublications(
    [polls[0], { ...polls[0], surveyId: undefined }],
    {},
    sources,
    today,
  );
  assert.deepEqual(
    withoutEvidence.map((p) => p.firstPublication),
    [{ status: 'inconnue' }, { status: 'inconnue' }],
  );
});
test('la référence appartient à la même enquête, est publique et correspond au calendrier de terrain', () => {
  const [survey, row] = Object.entries(evidence)[0];
  const check = (change) =>
    withFirstPublications(
      polls,
      { [survey]: { ...row, ...change } },
      sources,
      today,
    );
  for (const invalid of [
    { date: '1999-12-31' },
    { date: '2026-02-30' },
    { checked: '1999-12-31' },
    { checked: '9999-01-01' },
    { page: 0 },
    { localTime: '25:00' },
    { sourceId: 'notice-odoxa-2026-10-14' },
    { documentUrl: 'https://example.org/article' },
    { documentUrl: 'http://www.commission-des-sondages.fr/notice' },
  ])
    assert.throws(() => check(invalid));
  assert.throws(() =>
    withFirstPublications(polls, { inconnue: row }, sources, today),
  );
});
test('les mentions de première diffusion ne modifient ni les versions ni les octets des graphiques historiques', () => {
  for (const [i, p] of polls.entries()) {
    if (p.published > '2026-11-24') continue;
    assert.deepEqual(
      pollGraphic(annotated[i], sources),
      pollGraphic(p, sources),
    );
  }
});

test('la publication observée, le rapport et l’horaire annoncé restent identifiés séparément pour le même terrain', () => {
  const survey = (id) => annotated.find((p) => p.surveyId === id);
  const ipsos = survey('ipsos-bva-2026-10-21');
  assert.deepEqual(
    ipsos.publicationDocuments.map((d) => [d.kind, d.date, d.localTime]),
    [
      ['article', '2026-10-24', '16:59'],
      ['horaire-annonce', '2026-10-24', '17:00'],
    ],
  );
  assert.equal(ipsos.firstPublication.status, 'inconnue');
  const huff = survey('yougov-2026-11-12');
  assert.equal(huff.publicationDocuments[0].date, '2026-11-18');
  assert.equal(huff.published, '2026-11-19');
  assert.deepEqual(
    survey('opinionway-presitrack-2026-11-09').publicationDocuments.map((d) => [
      d.kind,
      d.date,
    ]),
    [
      ['publication-institut', '2026-11-13'],
      ['rapport', '2026-11-12'],
    ],
  );
  assert.deepEqual(
    survey('opinionway-cnews-2026-11-10').publicationDocuments.map(
      (d) => d.kind,
    ),
    ['notice'],
  );
  assert.equal(
    survey('ifop-sud-radio-2026-11-02').publicationDocuments[0].date,
    '2026-11-20',
  );
  assert.equal(
    survey('harris-2026-11-03').publicationDocuments[0].localTime,
    '05:00',
  );
  assert.equal(
    survey('harris-2026-11-18').publicationDocuments[0].localTime,
    '05:00',
  );
  assert.notEqual(
    survey('harris-2026-11-03').publicationDocuments[0].url,
    survey('harris-2026-11-18').publicationDocuments[0].url,
  );
  for (const [id, entry] of Object.entries(documents)) {
    const rows = annotated.filter((p) => p.surveyId === id);
    assert.ok(rows.length);
    for (const p of rows) {
      assert.equal(p.firstPublication.status, 'inconnue');
      assert.equal(p.publicationDocuments.length, entry.documents.length);
      assert.ok(
        p.publicationDocuments.every((d) => d.checked === entry.checked),
      );
    }
  }
});
test('les documents doivent correspondre à la notice et aux dates du terrain', () => {
  const key = 'ipsos-bva-2026-10-21';
  for (const mutate of [
    (entry) => (entry.noticeSource = 'notice-elabe-2026-11-14'),
    (entry) => (entry.documents[0].date = '2026-10-01'),
    (entry) => delete entry.documents[0].date,
    (entry) => (entry.documents[0].localTime = '32:00'),
    (entry) => entry.documents.push(entry.documents[0]),
    (entry) => (entry.documents[0].url = 'file:///tmp/article'),
    (entry) => (entry.documents[1].url = 'https://other.example/notice.pdf'),
    (entry) => delete entry.documents[1].page,
    (entry) => (entry.checked = '2026-10-01'),
  ]) {
    const entry = structuredClone(documents[key]);
    mutate(entry);
    assert.throws(() =>
      withFirstPublications(polls, evidence, sources, today, { [key]: entry }),
    );
  }
});
