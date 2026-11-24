import { campaignBriefs } from './briefs';
import reviewRows from '../data/editorial-reviews.json';
import {
  editorialDayAccess,
  editorialReviewSchema,
  editorialRunsByDay,
} from './editorial-reviews.mjs';
import { candidates, sources, polls } from './data';
import { agenda } from './visual-data';

export async function briefEditions() {
  const briefs = await campaignBriefs();
  const reports = editorialReviewSchema(candidates, sources).parse(reviewRows);
  const reviews = editorialRunsByDay(reports);
  const days = new Set([
    ...reviews.keys(),
    ...briefs.map((b) => b.article.data.published),
  ]);
  return [...days]
    .sort()
    .reverse()
    .map((day) => {
      const passages = reviews.get(day) ?? [];
      const surveys = new Map(
        polls.filter((p) => p.published === day).map((p) => [p.surveyId, p]),
      );
      return {
        day,
        passages,
        access: editorialDayAccess(passages),
        briefs: briefs.filter((b) => b.article.data.published === day),
        meetings: agenda.events.filter((e) => e.date === day),
        surveys: [...surveys.values()],
      };
    });
}
