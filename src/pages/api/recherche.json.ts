import type { APIRoute } from 'astro';
import { searchEntries } from '../../lib/search';
export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await searchEntries()), {
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
  });
