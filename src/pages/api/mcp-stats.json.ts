import type { APIRoute } from 'astro';

// A static release can precede the separate activation of the MCP service.
export const GET: APIRoute = () =>
  Response.json(
    { status: 'unavailable' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
