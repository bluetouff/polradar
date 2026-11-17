import type { APIRoute } from 'astro';
import { candidates, themes, sources, engagements, meta } from '../../lib/data';
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({ candidates, themes, sources, engagements, meta }),
    { headers: { 'Content-Type': 'application/json;charset=utf-8' } },
  );
