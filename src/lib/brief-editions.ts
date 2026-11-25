import { campaignBriefs } from './briefs';
import reviewRows from '../data/editorial-reviews.json';
import {
  editorialDayAccess,
  editorialReviewSchema,
  editorialRunsByDay,
} from './editorial-reviews.mjs';
import {
  candidates,
  sources,
  documentedPolls,
  dataset,
  electionRounds,
} from './data';
import { measureChanges } from './follow-measures.mjs';
import type { Change } from './follow-view';
import { agenda } from './visual-data';

export async function briefEditions() {
  const briefs = await campaignBriefs();
  const reports = editorialReviewSchema(candidates, sources).parse(reviewRows);
  const reviews = editorialRunsByDay(reports);
  const days = new Set([
    ...reviews.keys(),
    ...briefs.map((b) => b.article.data.published),
  ]);
  const firstEdition = [...days].sort()[0];
  const programmes = new Set(
    candidates.flatMap((c) => c.programmeReview?.sources ?? []),
  );
  const documents = sources.filter(
    (s) =>
      programmes.has(s.id) &&
      s.published &&
      firstEdition &&
      s.published >= firstEdition,
  );
  const substantive = new Set(
    dataset.versions
      .filter(
        (v) =>
          v.recordedAt &&
          v.snapshot.scope !== 'archive' &&
          ((v.kind === 'import' && v.number === 1) || v.kind === 'programme'),
      )
      .map((v) => v.id),
  );
  const changes: Change[] = measureChanges(dataset);
  const measures = changes.filter(
    (c) =>
      substantive.has(c.id) &&
      c.day >= firstEdition &&
      (!c.before ||
        c.after?.fields.some((f) =>
          [
            'Proposition',
            'Bénéficiaires',
            'Calendrier',
            'Financement',
            'Paramètres chiffrés',
            'Montants',
          ].includes(f.label),
        )),
  );
  for (const { day } of measures) days.add(day);
  for (const { published } of documents) days.add(published!);
  for (const { published } of documentedPolls)
    if (firstEdition && published >= firstEdition) days.add(published);
  return [...days]
    .sort()
    .reverse()
    .map((day) => {
      const passages = reviews.get(day) ?? [];
      const surveys = new Map(
        documentedPolls
          .filter((p) => p.published === day)
          .map((p) => [p.surveyId ?? p.id, p]),
      );
      return {
        day,
        passages,
        access: editorialDayAccess(passages),
        briefs: briefs.filter((b) => b.article.data.published === day),
        meetings: agenda.events.filter((e) => e.date === day),
        surveys: [...surveys.values()],
        documents: documents.filter((s) => s.published === day),
        measures: measures.filter((m) => m.day === day),
        deadlines: electionRounds.filter((e) => e.date >= day).slice(0, 2),
      };
    });
}
