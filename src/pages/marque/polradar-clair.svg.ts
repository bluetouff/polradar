import type { APIRoute } from 'astro';
import logo from '../../../public/marque/polradar.svg?raw';

export const GET: APIRoute = () =>
  new Response(
    logo
      .replace('color="#193744"', 'color="#f5f8f9"')
      .replaceAll('var(--logo-signal, currentColor)', '#98d0d9'),
    { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } },
  );
