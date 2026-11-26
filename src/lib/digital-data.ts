import topics from '../data/digital-topics.json';
import { candidates, measures, sources } from './data';
import { digitalMeasureIds } from './digital-topics.mjs';

const referenced = new Set<string>();
export const digitalTopics = topics.map((topic) => {
  const entries = digitalMeasureIds(topic)
    .map((id) => {
      const measure = measures.find((entry) => entry.id === id);
      const candidate = candidates.find(
        (entry) => entry.id === measure?.candidate,
      );
      const source = sources.find(
        (entry) => entry.id === measure?.sourceRefs[0].sourceId,
      );
      if (
        !measure ||
        !candidate ||
        measure.scope === 'archive' ||
        !source ||
        (!['campagne', 'parti'].includes(source.kind) &&
          !(source.kind === 'presse' && source.originalFormat)) ||
        referenced.has(id)
      )
        throw new Error(`Fiche numérique invalide : ${id}`);
      referenced.add(id);
      return { measure, candidate, source };
    })
    .filter((entry) => !entry.candidate.withdrawnOn);
  const sorted = entries.sort(
    (a, b) =>
      a.measure.title.localeCompare(b.measure.title, 'fr') ||
      a.measure.id.localeCompare(b.measure.id),
  );
  const groups = (topic.groups ?? [])
    .map((group) => ({
      id: group.id,
      label: group.label,
      entries: sorted.filter(({ measure }) =>
        group.measures.includes(measure.id),
      ),
    }))
    .filter((group) => group.entries.length);
  return {
    ...topic,
    groups,
    entries: sorted,
    candidateCount: new Set(entries.map((entry) => entry.candidate.id)).size,
  };
});
export const digitalCount = digitalTopics.reduce(
  (count, topic) => count + topic.entries.length,
  0,
);
export const digitalTopicByMeasure = new Map(
  digitalTopics.flatMap((topic) =>
    topic.entries.map(({ measure }) => [measure.id, topic.id] as const),
  ),
);
export const digitalCandidates = new Set(
  digitalTopics.flatMap(({ entries }) =>
    entries.map(({ candidate }) => candidate.id),
  ),
).size;
