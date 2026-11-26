import type { APIRoute } from 'astro';
import { pollCoverage } from '../../lib/features.mjs';
import { budgetIdsByMeasure } from '../../lib/visual-data';
import { attributionLabel } from '../../lib/attribution.mjs';
import { voteCases } from '../../lib/votes-data';
import { proposalTracks } from '../../lib/proposal-data';
import { digitalTopicByMeasure } from '../../lib/digital-data';
import {
  candidateById,
  dataset,
  type Engagement,
  type Measure,
} from '../../lib/data';
const credited = (record: Measure | Engagement) => ({
  ...record,
  displayAuthor: attributionLabel(record, candidateById(record.candidate).name),
});
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      ...dataset,
      pollCoverage: pollCoverage(dataset.polls),
      programmeBudgetsUrl: '/api/budgets-programmes.json',
      measures: dataset.measures.map((m) => ({
        ...credited(m),
        ...(digitalTopicByMeasure.has(m.id)
          ? { digitalTopic: digitalTopicByMeasure.get(m.id) }
          : {}),
        voteCaseIds: voteCases
          .filter((v) => v.measureId === m.id)
          .map((v) => v.id),
        evolutionIds: proposalTracks
          .filter((t) => t.measureIds.includes(m.id))
          .map((t) => t.id),
        ...(budgetIdsByMeasure.has(m.id)
          ? { budgetEntryIds: budgetIdsByMeasure.get(m.id) }
          : {}),
      })),
      versions: dataset.versions.map((v) => {
        const measure = dataset.measures.find((m) => m.id === v.measureId)!;
        return {
          ...v,
          displayAuthor: attributionLabel(
            v.snapshot,
            candidateById(measure.candidate).name,
          ),
        };
      }),
      engagements: dataset.engagements.map(credited),
    }),
    {
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
    },
  );
