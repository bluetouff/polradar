import { getCollection } from 'astro:content';
import { events } from './data';

const byEvent = new Map(events.map((event) => [event.id, event]));

export async function campaignBriefs() {
  const articles = await getCollection('breves', ({ data }) => !data.draft);
  const written = articles.map((article) => ({
    article,
    entry: article,
    event: byEvent.get(article.data.event)!,
    href: '/breves/' + article.id + '/',
  }));
  const reported = events
    .filter(
      (event) =>
        event.publicationBrief &&
        !articles.some((a) => a.data.event === event.id),
    )
    .map((event) => ({
      entry: null,
      event,
      href: '/breves/' + event.id + '/',
      article: {
        id: event.id,
        data: {
          title: event.title,
          description: event.description,
          published: event.publicationBrief!,
        },
        body: '',
      },
    }));
  return [...written, ...reported].sort(
    (a, b) =>
      b.article.data.published.localeCompare(a.article.data.published) ||
      b.event.date.localeCompare(a.event.date) ||
      a.article.data.title.localeCompare(b.article.data.title, 'fr'),
  );
}

export type CampaignBrief = Awaited<ReturnType<typeof campaignBriefs>>[number];
