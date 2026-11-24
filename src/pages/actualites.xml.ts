import type { APIRoute } from 'astro';
import { campaignBriefs } from '../lib/briefs';
import { civilDateInParis } from '../lib/schema.mjs';
import { newsSitemap } from '../lib/news-sitemap.mjs';
export const GET: APIRoute = async () => {
  const articles = (await campaignBriefs())
    .filter((b) => b.entry)
    .map((b) => ({
      path: b.href,
      title: b.article.data.title,
      day: b.article.data.published,
    }));
  return new Response(newsSitemap(articles, civilDateInParis()), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
