import type { APIRoute } from 'astro';
import { searchIndex } from '../../../lib/parliament-search';
export const GET: APIRoute = () => Response.json(searchIndex);
