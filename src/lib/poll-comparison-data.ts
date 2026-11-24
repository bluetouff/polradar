import { sourceCommit } from '../../scripts/release-revision.mjs';
import { documentedPolls, sourceById } from './data';
import {
  backtestPollingSeries,
  compareReviewedScenarios,
  pollComparisonDays,
  scenarioMatrix,
} from './poll-comparison.mjs';

// Concordances lues dans les quatre notices. Le libellé du scénario seul
// ne suffit pas à créer une comparaison entre instituts.
const reviewed = [
  {
    id: 'philippe-retailleau',
    label: 'Hypothèse avec Philippe et Retailleau',
    observations: [
      'ipsos-2026-10-24-philippe',
      'ifop-2026-11-03-philippe-retailleau',
      'harris-2026-11-09-philippe',
    ],
  },
  {
    id: 'attal-philippe-retailleau',
    label: 'Hypothèse avec Attal, Philippe et Retailleau',
    observations: ['ipsos-2026-10-24-attal-philippe', 'harris-2026-11-09-p41'],
  },
  {
    id: 'attal-retailleau',
    label: 'Hypothèse avec Attal et Retailleau',
    observations: ['ipsos-2026-10-24-attal', 'harris-2026-11-09-attal'],
  },
  {
    id: 'philippe-retailleau-lisnard',
    label: 'Hypothèse avec Philippe, Retailleau et Lisnard',
    observations: [
      'ipsos-2026-10-24-philippe-lisnard',
      'ifop-2026-11-18-10384-p12',
    ],
  },
];
const pollsById = new Map(documentedPolls.map((poll) => [poll.id, poll]));
export const pollComparisons = reviewed.map((review) => {
  const rows = review.observations.map((id) => {
    const poll = pollsById.get(id);
    if (!poll || poll.question?.status !== 'verifiee')
      throw new Error('Scénario vérifié manquant : ' + id);
    return poll;
  });
  const comparison = compareReviewedScenarios(rows);
  return {
    ...review,
    ...comparison,
    round: rows[0].round,
    base: rows[0].question?.status === 'verifiee' ? rows[0].question.base : '',
    inputs: rows
      .filter((p) => comparison.observations.includes(p.id))
      .map((p) => ({
        id: p.id,
        institute: p.institute,
        commissioner: p.commissioner,
        fieldworkStart: p.fieldworkStart,
        fieldworkEnd: p.fieldworkEnd,
        usefulSample: p.usefulSample,
        published: p.published,
        margin: p.margin,
        question: p.question,
        source: sourceById(p.resultSource ?? p.noticeSource).url,
        page: p.resultPage ?? p.noticePage,
      })),
  };
});

export const pollComparisonExport = {
  version: 1,
  sourceCommit,
  windowDays: pollComparisonDays,
  weighting: 'une-observation-par-institut-poids-egaux',
  matrix: scenarioMatrix(documentedPolls),
  comparisons: pollComparisons,
  backtest: backtestPollingSeries(documentedPolls),
};
