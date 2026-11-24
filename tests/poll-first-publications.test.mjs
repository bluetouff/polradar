import test from 'node:test';
import assert from 'node:assert/strict';
import polls from '../src/data/polls.json' with { type: 'json' };
import sources from '../src/data/sources.json' with { type: 'json' };
import evidence from '../src/data/poll-first-publications.json' with { type: 'json' };
import { withFirstPublications } from '../src/lib/poll-first-publications.mjs';
import { pollGraphic } from '../src/lib/poll-graphic.mjs';

const today = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris',
}).format(new Date());
const annotated = withFirstPublications(polls, evidence, sources, today);
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
