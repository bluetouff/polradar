import type { APIRoute } from 'astro';
import { register, registerIndex } from '../../../lib/parliamentary-register';

// The full export is requested only when a reader filters the complete register.
export const GET: APIRoute = () =>
  Response.json({
    ...register,
    personnes: registerIndex.personnes,
  });
