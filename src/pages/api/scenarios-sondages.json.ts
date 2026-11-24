import type { APIRoute } from 'astro';
import { pollComparisonExport } from '../../lib/poll-comparison-data';

export const GET: APIRoute = () => Response.json(pollComparisonExport);
