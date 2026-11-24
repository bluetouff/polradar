import type { APIRoute } from 'astro';
import { senateRegister } from '../../../lib/senate-documents';

export const GET: APIRoute = () => Response.json(senateRegister);
