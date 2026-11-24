import { campaignBriefs } from './briefs';
import { civilDateInParis } from './schema.mjs';
import reviewRows from '../data/editorial-reviews.json';
import { editorialReviewSchema } from './editorial-reviews.mjs';
import { candidates, sources, polls } from './data';
import { agenda } from './visual-data';

export async function briefEditions() {
  const briefs = await campaignBriefs();
  const reports = editorialReviewSchema(candidates, sources).parse(reviewRows);
  const reviews = new Map(
    [...reports]
      .sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt))
      .map((r) => [civilDateInParis(new Date(r.checkedAt)), r]),
  );
  const days = new Set([
    ...reviews.keys(),
    ...briefs.map((b) => b.article.data.published),
  ]);
  return [...days]
    .sort()
    .reverse()
    .map((day) => {
      const review = reviews.get(day);
      const surveys = new Map(
        polls.filter((p) => p.published === day).map((p) => [p.surveyId, p]),
      );
      return {
        day,
        checkedAt: review?.checkedAt ?? null,
        consulted: review?.hosted?.checks.filter((s) => s.ok).length ?? null,
        unavailable: review?.hosted?.checks.filter((s) => !s.ok).length ?? null,
        briefs: briefs.filter((b) => b.article.data.published === day),
        meetings: agenda.events.filter((e) => e.date === day),
        surveys: [...surveys.values()],
      };
    });
}
