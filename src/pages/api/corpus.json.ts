import type { APIRoute } from 'astro';
import { pollCoverage } from '../../lib/features.mjs';
import { budgetIdsByMeasure } from '../../lib/visual-data';
import { attributionLabel } from '../../lib/attribution.mjs';
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
        ...(budgetIdsByMeasure.has(m.id)
          ? { budgetEntryIds: budgetIdsByMeasure.get(m.id) }
          : {}),
      })),
      engagements: dataset.engagements.map(credited),
    }),
    {
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
    },
  );
