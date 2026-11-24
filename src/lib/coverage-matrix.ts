export type MatrixRecord = {
  id: string;
  candidate: string;
  theme: string;
  scope: string;
  edition: string;
  documents: string[];
  topics: string[];
};
export type MatrixFilter = {
  candidate?: string;
  document?: string;
  theme?: string;
  scope?: string;
  edition?: string;
  topic?: string;
};
export function countCoverage(
  records: MatrixRecord[],
  filters: MatrixFilter = {},
) {
  const byTheme: Record<string, number> = Object.create(null);
  const docs = new Set<string>(),
    candidates = new Set<string>(),
    ids = new Set<string>();
  for (const row of records) {
    if (
      (filters.candidate && filters.candidate !== row.candidate) ||
      (filters.theme && filters.theme !== row.theme) ||
      (filters.document && !row.documents.includes(filters.document)) ||
      (filters.scope && filters.scope !== row.scope) ||
      (filters.edition && filters.edition !== row.edition) ||
      (filters.topic &&
        !(filters.topic === 'sans-classement'
          ? row.topics.length === 0
          : row.topics.includes(filters.topic)))
    )
      continue;
    if (ids.has(row.id))
      throw Error('Identifiant de fiche en double : ' + row.id);
    ids.add(row.id);
    candidates.add(row.candidate);
    row.documents.forEach((id) => docs.add(id));
    byTheme[row.theme] = (byTheme[row.theme] ?? 0) + 1;
  }
  return {
    measures: ids.size,
    documents: docs.size,
    candidates: candidates.size,
    byTheme,
  };
}
