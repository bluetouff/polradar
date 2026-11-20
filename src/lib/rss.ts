import { getCollection } from 'astro:content';
import {
  versions,
  measures,
  candidateById,
  themeById,
  formatDate,
} from './data';
const escape = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[char]!,
  );
interface FeedItem {
  title: string;
  url: string;
  guid: string;
  description: string;
  day: string;
  timestamp: string | null;
}
export async function rss(
  title: string,
  filter?: { candidate?: string; theme?: string },
) {
  const kind: Record<string, string> = {
    import: 'Fiche intégrée',
    enrichissement: 'Fiche précisée',
    correction: 'Correction',
    programme: 'Programme modifié',
  };
  const items: FeedItem[] = versions
    .filter((version) => {
      const measure = measures.find(
        (measure) => measure.id === version.measureId,
      )!;
      return (
        (!filter?.candidate || measure.candidate === filter.candidate) &&
        (!filter?.theme || measure.theme === filter.theme)
      );
    })
    .map((version) => {
      const measure = measures.find(
        (measure) => measure.id === version.measureId,
      )!;
      return {
        title: `${kind[version.kind]} · ${candidateById(measure.candidate).name} · ${version.snapshot.title}`,
        url: `https://polradar.fr/historique/?mesure=${measure.id}&apres=${version.number}`,
        guid: `https://polradar.fr/mesures/${measure.id}/#version-${version.number}`,
        description: `${version.summary}\n${version.snapshot.description}\n${themeById(measure.theme).label} · date de suivi : ${formatDate(version.observedOn)}`,
        day: version.observedOn,
        timestamp: version.recordedAt,
      };
    });
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  if (!filter?.candidate)
    for (const article of articles) {
      if (filter?.theme && !article.data.themes.includes(filter.theme))
        continue;
      items.push({
        title: article.data.title,
        url: `https://polradar.fr/dossiers/${article.id}/`,
        guid: `https://polradar.fr/dossiers/${article.id}/`,
        description: [
          article.data.description,
          article.data.themes.map((id) => themeById(id).label).join(' · '),
          `Publication : ${formatDate(article.data.published)}`,
        ]
          .filter(Boolean)
          .join('\n'),
        day: article.data.published,
        timestamp: null,
      });
    }
  items.sort(
    (a, b) =>
      b.day.localeCompare(a.day) ||
      (b.timestamp || '').localeCompare(a.timestamp || ''),
  );
  // Day-only source dates must not be turned into invented publication hours.
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escape(title)}</title><link>https://polradar.fr/</link><description>Fiches et publications Polradar</description><language>fr</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items.map((item) => `<item><title>${escape(item.title)}</title><link>${escape(item.url)}</link><guid>${escape(item.guid)}</guid><description>${escape(item.description)}</description>${item.timestamp ? `<pubDate>${new Date(item.timestamp).toUTCString()}</pubDate>` : ''}</item>`).join('')}</channel></rss>`,
    { headers: { 'Content-Type': 'application/rss+xml;charset=utf-8' } },
  );
}
