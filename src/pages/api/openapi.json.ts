import type { APIRoute } from 'astro';
import { openapi } from '../../lib/api-reference.mjs';
export const GET: APIRoute = () => Response.json(openapi);
