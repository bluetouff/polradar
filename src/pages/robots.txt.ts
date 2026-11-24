import type { APIRoute } from 'astro';
export const GET: APIRoute = () =>
  new Response(
    'User-agent: Twitterbot\nDisallow: /stats/\nAllow: /\n\nUser-agent: *\nDisallow: /stats/\nDisallow: /recherche/\nAllow: /\n\nSitemap: https://polradar.fr/sitemap.xml\nSitemap: https://polradar.fr/actualites.xml\n',
    { headers: { 'Content-Type': 'text/plain;charset=utf-8' } },
  );
