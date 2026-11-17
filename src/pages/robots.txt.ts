import type { APIRoute } from 'astro';
export const GET: APIRoute = () =>
  new Response(
    'User-agent: *\nAllow: /\nDisallow: /recherche/\nSitemap: https://polradar.fr/sitemap.xml\n',
    { headers: { 'Content-Type': 'text/plain;charset=utf-8' } },
  );
