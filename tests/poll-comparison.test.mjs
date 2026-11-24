import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  backtestPollingSeries,
  compareReviewedScenarios,
  scenarioMatrix,
} from '../src/lib/poll-comparison.mjs';

const polls = JSON.parse(
  readFileSync(new URL('../src/data/polls.json', import.meta.url)),
);
const byId = new Map(polls.map((p) => [p.id, p]));
const reviewed = [
  byId.get('ifop-2026-11-03-philippe-retailleau'),
  byId.get('ipsos-2026-10-24-philippe'),
  byId.get('harris-2026-11-09-philippe'),
];

test('les trois notices donnent une moyenne reproductible dans la même hypothèse', () => {
  const matrix = scenarioMatrix(polls);
  const group = matrix.find((row) => row.observations.includes(reviewed[0].id));
  assert.ok(reviewed.every((poll) => group.observations.includes(poll.id)));
  assert.equal(
    matrix.reduce((sum, row) => sum + row.observations.length, 0),
    polls.length,
  );
  const { estimates, observations } = compareReviewedScenarios(reviewed);
  assert.equal(observations.length, 3);
  assert.deepEqual(
    estimates.find((e) => e.id === 'lepen'),
    {
      id: 'lepen',
      name: 'Marine Le Pen',
      mean: 35.5,
      min: 33.5,
      max: 37,
    },
  );
});

test('une nouvelle publication du même institut ne compte qu’une fois', () => {
  const duplicate = { ...reviewed[0], id: 'reprise', published: '2026-11-04' };
  const result = compareReviewedScenarios([duplicate, ...reviewed]);
  assert.equal(result.observations.length, 3);
  assert.ok(result.observations.includes('reprise'));
  assert.ok(!result.observations.includes(reviewed[0].id));
  const alone = compareReviewedScenarios([reviewed[0], duplicate]);
  assert.equal(alone.estimates, null);
});

test('les listes et les bases différentes sont refusées et une valeur absente laisse le score inconnu', () => {
  assert.throws(
    () =>
      compareReviewedScenarios([
        reviewed[0],
        byId.get('ipsos-2026-10-24-attal'),
      ]),
    /incompatibles/,
  );
  const sameRoster = structuredClone(reviewed[1]);
  sameRoster.question.base = 'Inscriptions sans condition de participation';
  assert.throws(
    () => compareReviewedScenarios([reviewed[0], sameRoster]),
    /incompatibles/,
  );
  const censored = byId.get('ifop-2026-11-18-10384-p12');
  const result = compareReviewedScenarios([
    censored,
    byId.get('ipsos-2026-10-24-philippe-lisnard'),
  ]);
  const unavailable = censored.results.find((row) => row.percentage === null);
  assert.ok(unavailable);
  assert.equal(
    result.estimates.find((row) => row.id === unavailable.id).mean,
    null,
  );
});

test('le test rétrospectif exclut la cible et les publications postérieures au début de son terrain', () => {
  const { rows, terrains } = backtestPollingSeries(polls);
  assert.ok(terrains >= 3);
  for (const row of rows) {
    const target = byId.get(row.target);
    const inputs = row.observations.map((id) => byId.get(id));
    assert.ok(inputs.every((p) => p.published < target.fieldworkStart));
    assert.ok(inputs.every((p) => p.surveyId !== target.surveyId));
    assert.equal(inputs.length, new Set(inputs.map((p) => p.surveyId)).size);
  }
  const risk = rows.find((row) => row.target === 'harris-commission-10332-p59');
  assert.ok(risk);
  assert.ok(risk.observations.includes('harris-commission-10305-p55'));
});
