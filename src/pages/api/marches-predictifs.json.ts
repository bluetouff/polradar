import type { APIRoute } from 'astro';
import { predictionMarkets } from '../../lib/market-data';
export const GET: APIRoute = () =>
  new Response(JSON.stringify(predictionMarkets), {
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
  });
