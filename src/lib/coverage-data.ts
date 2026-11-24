import { dataset } from './data';
import digital from '../data/digital-topics.json';
import comparisons from '../data/digital-comparison.json';
import law from '../data/digital-law.json';
import divergences from '../data/divergence-positions.json';
import type { MatrixRecord } from './coverage-matrix';

const direct = digital.map((t) => ({
  id: 'numerique-' + t.id,
  label: t.label,
  measures: t.measures,
}));
const viaVersion = new Map(dataset.versions.map((v) => [v.id, v.measureId]));
function fromVersions(list: string[]) {
  return list.map((id) => {
    const measure = viaVersion.get(id);
    if (!measure) throw Error('Version absente : ' + id);
    return measure;
  });
}
const positions = divergences.map((topic) => ({
  id: topic.id,
  label: topic.label,
  measures: fromVersions(topic.positions.flatMap((p) => p.versions)),
}));
const policy = law.sections.map((topic) => ({
  id: 'droit-' + topic.id,
  label: topic.title,
  measures: fromVersions(
    topic.cases.flatMap((c) => c.changes.map((change) => change.versionId)),
  ),
}));
for (const topic of comparisons.axes) {
  const row = policy.find((p) => p.id === 'droit-' + topic.id)!;
  row.measures.push(
    ...fromVersions(
      topic.rows.flatMap((r) => r.entries.map((e) => e.versionId)),
    ),
  );
}
const membership = new Map<string, string[]>();
export const matrixTopics = [...direct, ...positions, ...policy]
  .map((t) => {
    for (const id of new Set(t.measures)) {
      const items = membership.get(id) ?? [];
      items.push(t.id);
      membership.set(id, items);
    }
    return { id: t.id, label: t.label };
  })
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
export const matrixRows: MatrixRecord[] = dataset.measures.map((m) => ({
  id: m.id,
  candidate: m.candidate,
  theme: m.theme,
  scope: m.scope,
  edition: m.edition,
  documents: [...new Set(m.sourceRefs.map((r) => r.sourceId))],
  topics: membership.get(m.id) ?? [],
}));
export const matrixEditions = [
  ...new Set(matrixRows.map((row) => row.edition)),
].sort((a, b) => a.localeCompare(b, 'fr'));
