import type { APIRoute } from 'astro';
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
      measures: dataset.measures.map(credited),
      engagements: dataset.engagements.map(credited),
    }),
    {
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
    },
  );
