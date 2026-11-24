import test from 'node:test';
import assert from 'node:assert/strict';
import polls from '../src/data/polls.json' with { type: 'json' };
import sources from '../src/data/sources.json' with { type: 'json' };
import catalogue from '../src/data/poll-catalogue.json' with { type: 'json' };
import audits from '../src/data/poll-notice-audits.json' with { type: 'json' };
import { catalogueCoverage } from '../src/lib/poll-catalogue.mjs';

test('Chaque hypothèse Harris de juillet à octobre 2026 renvoie à la question et à son tableau', () => {
  const coverage = catalogueCoverage(catalogue, polls, sources, audits);
  for (const [number, secondRounds] of [
    ['10223', 3],
    ['10263', 3],
    ['10305', 2],
    ['10332', 3],
  ]) {
    const rows = polls.filter(
      (p) => p.surveyId === 'harris-commission-' + number,
    );
    const review = coverage.find((entry) => entry.number === number);
    assert.equal(review.status, 'integree');
    assert.equal(rows.filter((p) => p.round === 'premier').length, 5);
    assert.equal(rows.filter((p) => p.round === 'second').length, secondRounds);
    for (const poll of rows) {
      assert.equal(poll.historicalImport, true);
      assert.equal(poll.question.sourceId, poll.noticeSource);
      assert.ok([10, 11, 12].includes(poll.question.page));
      assert.ok(review.audit.pages.includes(poll.noticePage));
      assert.ok(poll.question.wording.includes('élection présidentielle'));
    }
  }
});

test('Juillet distingue les candidats du récapitulatif commun et les scores de la vague de ceux du rappel', () => {
  const july = polls.filter((p) => p.surveyId === 'harris-commission-10223');
  const scores = (page) =>
    Object.fromEntries(
      july
        .find((p) => p.noticePage === page)
        .results.map((r) => [r.id, r.percentage]),
    );
  const withGlucksmann = scores(38);
  assert.equal(withGlucksmann.glucksmann, 11);
  assert.equal(withGlucksmann['sonde-francois-hollande'], undefined);
  assert.equal(withGlucksmann.melenchon, 16);
  const withHollande = scores(40);
  assert.equal(withHollande['sonde-francois-hollande'], 8);
  assert.equal(withHollande.glucksmann, undefined);
  assert.equal(scores(49).attal, 45);
  for (const p of july) {
    assert.equal(p.sampleSize, 1837);
    assert.equal(p.registeredSample, 1592);
    assert.equal(p.usefulSample, null);
  }
});
