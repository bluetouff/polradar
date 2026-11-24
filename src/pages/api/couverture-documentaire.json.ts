import type { APIRoute } from 'astro';
import { matrixRows, matrixTopics } from '../../lib/coverage-data';
export const GET: APIRoute = () =>
  Response.json({
    version: 1,
    unit: 'fiche de mesure',
    topics: matrixTopics,
    records: matrixRows,
  });
