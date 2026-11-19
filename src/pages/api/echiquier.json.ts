import type { APIRoute } from 'astro';
import extract from '../../data/ches-france-2024.json';
import { chesFranceSchema } from '../../lib/ches.mjs';
export const GET: APIRoute = () =>
  new Response(JSON.stringify(chesFranceSchema.parse(extract)), {
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
  });
