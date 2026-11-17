import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
const escape = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
export const GET: APIRoute = async () => {
  const articles = (
    await getCollection('articles', ({ data }) => !data.draft)
  ).sort((a, b) => b.data.published.localeCompare(a.data.published));
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Polradar</title><link>https://polradar.fr/</link><description>Les décryptages de la campagne présidentielle</description><language>fr</language>${articles.map((a) => `<item><title>${escape(a.data.title)}</title><link>https://polradar.fr/dossiers/${a.id}/</link><guid>https://polradar.fr/dossiers/${a.id}/</guid><description>${escape(a.data.description)}</description><pubDate>${new Date(`${a.data.published}T12:00:00Z`).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`,
    { headers: { 'Content-Type': 'application/rss+xml;charset=utf-8' } },
  );
};
