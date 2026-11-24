import type { APIRoute } from 'astro';
import { documents } from '../../lib/documents';
export const GET: APIRoute = () =>
  Response.json({
    schemaVersion: 1,
    unit: 'référence documentaire du corpus Polradar',
    coverageUnit:
      'étape de la section indiquée dont le sujet est relié à au moins une fiche',
    documents,
  });
