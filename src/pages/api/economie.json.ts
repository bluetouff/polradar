import type { APIRoute } from 'astro';
import {
  economy,
  economyCollectedAt,
  statements,
} from '../../lib/economy-data';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      collectedAt: economyCollectedAt,
      series: economy,
      statements,
    }),
    {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
  );
