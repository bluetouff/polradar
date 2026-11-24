import type { APIRoute } from 'astro';
import { candidates, themes } from '../../lib/data';

export const GET: APIRoute = () =>
  Response.json({
    candidates: candidates.map(({ id }) => id),
    themes: themes.map(({ id }) => id),
  });
