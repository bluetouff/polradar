import type { APIRoute } from 'astro';
import { salaryGraphic } from '../../lib/csg-paie.mjs';
export const GET: APIRoute = () =>
  new Response(salaryGraphic().svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
