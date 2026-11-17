import type { APIRoute } from 'astro';
import { dataset } from '../../lib/data';
export const GET: APIRoute = () =>
  new Response(JSON.stringify(dataset), {
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
  });
