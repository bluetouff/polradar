import test from 'node:test';
import assert from 'node:assert/strict';
import polls from '../src/data/polls.json' with { type: 'json' };
import sources from '../src/data/sources.json' with { type: 'json' };
import catalogue from '../src/data/poll-catalogue.json' with { type: 'json' };
import audits from '../src/data/poll-notice-audits.json' with { type: 'json' };
import { catalogueCoverage } from '../src/lib/poll-catalogue.mjs';
import { renderPollGraphic } from '../src/lib/poll-graphic-view.mjs';

const imported = [
  ['10193', 11],
  ['10222', 5],
  ['10314', 4],
  ['9944', 2],
  ['9912', 4],
  ['10118', 10],
  ['10195', 8],
  ['10224', 3],
  ['10259', 3],
  ['10318', 3],
  ['10192', 11],
  ['10180', 4],
  ['10165', 2],
  ['9995', 4],
];

test('Chaque notice relue couvre des scénarios traçables et rendus dans le Studio', () => {
  const coverage = catalogueCoverage(catalogue, polls, sources, audits);
  for (const [number, count] of imported) {
    const notice = coverage.find((entry) => entry.number === number);
    assert.equal(notice.status, 'integree');
    assert.equal(notice.scenarios.length, count);
    for (const { id, page } of notice.scenarios) {
      const row = polls.find((p) => p.id === id);
      assert.equal(row.historicalImport, true);
      assert.equal(row.question.status, 'verifiee');
      assert.equal(row.question.sourceId, row.noticeSource);
      assert.equal(row.noticePage, page);
      const graphic = renderPollGraphic(row, sources);
      assert.ok(graphic.svg.startsWith('<svg'));
      assert.match(graphic.sources[0].url, new RegExp('#page=' + page + '$'));
    }
  }
});

test('Présitrack reprend les noms et scores du récapitulatif OpinionWay lorsque la notice diverge', () => {
  const september = polls.filter(
    (poll) => poll.surveyId === 'opinionway-commission-10259',
  );
  assert.deepEqual(
    september.map((p) => p.noticePage),
    [13, 14, 15],
  );
  const baseline = september[0];
  assert.equal(
    baseline.resultSource,
    'rapport-opinionway-presitrack-septembre-2026',
  );
  assert.equal(baseline.resultPage, 23);
  assert.equal(baseline.results.find((r) => r.id === 'lepen').percentage, 34);
  assert.equal(baseline.results.find((r) => r.id === 'zemmour').percentage, 4);
  assert.deepEqual(
    baseline.results.find((r) => r.id === 'arthaud'),
    {
      id: 'arthaud',
      name: 'Nathalie Arthaud',
      percentage: null,
      below: 1,
    },
  );
  assert.equal(baseline.usefulSample, null);
});

test('Toluna Harris sépare les rappels, les scénarios chiffrés et leurs questions', () => {
  const may = polls.filter(
    (poll) => poll.surveyId === 'harris-commission-10192',
  );
  const duels = may.filter((poll) => poll.round === 'second');
  assert.equal(duels.length, 6);
  assert.deepEqual(
    duels.map((p) => p.question.page),
    [23, 24, 25, 23, 24, 25],
  );
  assert.deepEqual(
    duels.map((p) => p.noticePage),
    [49, 51, 53, 56, 58, 60],
  );
  assert.ok(may.every((p) => p.usefulSample === null));
  const april = polls.find((poll) => poll.id === 'harris-commission-10180-p28');
  assert.equal(april.results.find((r) => r.id === 'philippe').percentage, 19);
  assert.equal(april.noticePage, 28);
});

test('Le catalogue distingue les choix de vote des souhaits, de la participation et des primaires', () => {
  const coverage = new Map(
    catalogueCoverage(catalogue, polls, sources, audits).map((notice) => [
      notice.number,
      notice,
    ]),
  );
  for (const [number, whatWasMeasured] of [
    ['10387', /primaire de la droite et du centre/],
    ['10381', /participation envisagée/],
    ['10377', /premier et un deuxième choix/],
    ['10369', /séparément/],
    ['10210', /souhaitent que ce duel ait lieu/],
  ]) {
    const notice = coverage.get(number);
    assert.equal(notice.status, 'non_pertinente');
    assert.deepEqual(notice.scenarios, []);
    assert.match(notice.audit.reason, whatWasMeasured);
    assert.match(notice.audit.reason, /^Pages? \d/);
  }
  for (const number of ['10246', '10141', '10292'])
    assert.notEqual(coverage.get(number).status, 'non_pertinente');
});
