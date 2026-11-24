import type { APIRoute } from 'astro';
import { documentaryHealth } from '../../lib/documentary-health';

export const GET: APIRoute = () => Response.json(documentaryHealth);
