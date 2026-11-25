import { activeCandidates, candidates } from './data';
import { questions, questionThemes } from './questions';

const states = [
  'mesure',
  'declaration',
  'orientation',
  'parti',
  'revue',
  'a-examiner',
] as const;
type State = (typeof states)[number];
const totals = (rows: { state: State }[]) =>
  Object.fromEntries(
    states.map((state) => [
      state,
      rows.filter((r) => r.state === state).length,
    ]),
  ) as Record<State, number>;

export const questionCoverage = questions.map((question) => {
  const rows = activeCandidates.map(({ id }) => {
    const entries = question.entries.filter((row) => row.candidate.id === id);
    const reviews = question.reviews.filter((row) => row.candidate === id);
    const documents = new Map(
      entries.flatMap((e) =>
        e.refs.flatMap(({ source }) =>
          source ? [[source.id, source] as const] : [],
        ),
      ),
    );
    for (const review of reviews)
      if (review.source) documents.set(review.sourceId, review.source);
    const state = (question.coverage[id] ?? 'a-examiner') as State;
    return {
      candidate: id,
      state,
      measures: entries.map(({ measure, version, author }) => ({
        id: measure.id,
        version: version.id,
        attribution: author,
        scope: version.snapshot.scope,
      })),
      documents: [...documents.values()].map(
        ({ id, kind, originalFormat, published, checked }) => ({
          id,
          type: originalFormat ?? kind,
          published,
          consultedOn: checked,
        }),
      ),
      reviews: reviews.map(({ sourceId, checked, locator }) => ({
        sourceId,
        checked,
        locator,
      })),
    };
  });
  const counts = totals(rows);
  return {
    question: question.id,
    title: question.title,
    href: question.href,
    theme: question.theme,
    examined: rows.length - counts['a-examiner'],
    counts,
    rows,
  };
});

export const coverageByTheme = questionThemes.flatMap(({ id, label }) => {
  const topics = questionCoverage.filter((q) => q.theme === id);
  if (!topics.length) return [];
  const rows = topics.flatMap((q) => q.rows);
  const counts = totals(rows);
  const byDocumentType: Record<string, number> = {};
  for (const row of rows)
    for (const type of new Set(row.documents.map((d) => d.type)))
      byDocumentType[type] = (byDocumentType[type] ?? 0) + 1;
  return [
    {
      theme: id,
      label,
      questions: topics.length,
      examined: rows.length - counts['a-examiner'],
      counts,
      byDocumentType,
    },
  ];
});
export const questionCoverageWithdrawals = candidates
  .filter(({ withdrawnOn }) => withdrawnOn)
  .map(({ id, withdrawnOn }) => ({ id, withdrawnOn }));
