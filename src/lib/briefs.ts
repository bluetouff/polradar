import { getCollection } from 'astro:content';
import { events } from './data';

const byEvent = new Map(events.map((event) => [event.id, event]));

export async function campaignBriefs() {
  const articles = await getCollection('breves', ({ data }) => !data.draft);
  return articles
    .map((article) => ({
      article,
      event: byEvent.get(article.data.event)!,
      href: '/breves/' + article.id + '/',
    }))
    .sort(
      (a, b) =>
        b.article.data.published.localeCompare(a.article.data.published) ||
        b.event.date.localeCompare(a.event.date) ||
        a.article.data.title.localeCompare(b.article.data.title, 'fr'),
    );
}

export type CampaignBrief = Awaited<ReturnType<typeof campaignBriefs>>[number];
