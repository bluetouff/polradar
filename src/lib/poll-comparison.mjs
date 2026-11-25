import { comparePollWaves, pollSeries } from './features.mjs';

const dayMs = 86_400_000;
export const pollComparisonDays = 45;

/** @typedef {import('./data').Poll} Poll */

/** @param {Poll} poll */
const lineup = (poll) =>
  JSON.stringify([poll.round, poll.results.map(({ id }) => id).sort()]);

/** @param {Poll} poll */
const verified = (poll) =>
  poll.question?.status === 'verifiee' && Boolean(poll.surveyId);

/** @param {Poll[]} polls */
export function scenarioMatrix(polls) {
  const sets = new Map();
  for (const poll of polls) {
    const key = lineup(poll);
    const group = sets.get(key) ?? [];
    group.push(poll);
    sets.set(key, group);
  }
  return [...sets].map(([key, group]) => {
    const [round, candidates] = JSON.parse(key);
    return {
      round,
      candidates,
      institutes: [...new Set(group.map((p) => p.institute))].sort(),
      observations: group.sort(comparePollWaves).map((p) => p.id),
      comparableSeries: pollSeries(group)
        .filter((series) => series.length > 1)
        .map((series) => series.map((p) => p.id)),
    };
  });
}

/** @param {Poll[]} polls @param {boolean} perInstitute @param {string} before */
function inputWaves(polls, perInstitute, before) {
  const eligible = polls
    .filter((p) => verified(p) && p.published && p.published < before)
    .sort(comparePollWaves);
  const last = eligible.at(-1);
  if (!last) return [];
  const earliest = Date.parse(last.fieldworkEnd) - pollComparisonDays * dayMs;
  const selected = new Map();
  const terrains = new Set();
  for (const poll of eligible.reverse()) {
    if (Date.parse(poll.fieldworkEnd) < earliest) break;
    if (
      terrains.has(poll.surveyId) ||
      (perInstitute && selected.has(poll.institute))
    )
      continue;
    terrains.add(poll.surveyId);
    selected.set(perInstitute ? poll.institute : poll.surveyId, poll);
  }
  return [...selected.values()].reverse();
}

/** @param {Poll[]} used */
function means(used) {
  if (used.length < 2) return null;
  return used[0].results
    .map(({ id, name }) => {
      const values = used
        .map((poll) => poll.results.find((r) => r.id === id)?.percentage)
        .filter((value) => typeof value === 'number' && Number.isFinite(value));
      if (values.length !== used.length)
        return { id, name, mean: null, min: null, max: null };
      return {
        id,
        name,
        mean: values.reduce((sum, value) => sum + value, 0) / used.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** @param {Poll[]} polls */
export function compareReviewedScenarios(polls) {
  if (
    !polls.length ||
    polls.some(
      (p) =>
        !verified(p) ||
        !p.published ||
        lineup(p) !== lineup(polls[0]) ||
        p.population !== polls[0].population ||
        p.method !== polls[0].method ||
        p.question.base !== polls[0].question.base,
    )
  )
    throw new Error('Hypothèses de sondage incompatibles');
  const used = inputWaves(polls, true, '9999-12-31');
  return {
    observations: used.map((p) => p.id),
    from: used[0].fieldworkEnd,
    through: used.at(-1).fieldworkEnd,
    estimates: means(used),
  };
}

/** Replay each available comparison using only surveys known before its fieldwork.
 * @param {Poll[]} polls
 */
export function backtestPollingSeries(polls) {
  const rows = [];
  for (const series of pollSeries(polls)) {
    const numeric = series.filter(
      (p) =>
        verified(p) && p.results.every(({ percentage }) => percentage !== null),
    );
    const tested = new Set();
    for (const target of numeric) {
      if (tested.has(target.surveyId)) continue;
      const inputs = inputWaves(
        numeric.filter((p) => p.surveyId !== target.surveyId),
        false,
        target.fieldworkStart,
      ).filter(
        (p) =>
          Date.parse(target.fieldworkStart) - Date.parse(p.fieldworkEnd) <=
          pollComparisonDays * dayMs,
      );
      const center = means(inputs);
      if (!center) continue;
      tested.add(target.surveyId);
      const errors = center.map((value) => {
        const actual = target.results.find((r) => r.id === value.id).percentage;
        const latest = inputs
          .at(-1)
          .results.find((r) => r.id === value.id).percentage;
        return {
          id: value.id,
          actual,
          meanError: Math.abs(value.mean - actual),
          latestError: Math.abs(latest - actual),
          inRange: value.min <= actual && actual <= value.max,
        };
      });
      rows.push({
        target: target.id,
        survey: target.surveyId,
        observations: inputs.map((p) => p.id),
        errors,
      });
    }
  }
  const errors = rows.flatMap((row) => row.errors);
  return {
    validation: 'terrain-publie-ulterieurement',
    scenarios: rows.length,
    terrains: new Set(rows.map((row) => row.survey)).size,
    scores: errors.length,
    meanError: errors.length
      ? errors.reduce((sum, row) => sum + row.meanError, 0) / errors.length
      : null,
    latestError: errors.length
      ? errors.reduce((sum, row) => sum + row.latestError, 0) / errors.length
      : null,
    insideObservedRange: errors.filter((row) => row.inRange).length,
    rows,
  };
}
