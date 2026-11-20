import topics from '../data/digital-topics.json';
import { candidates, measures, sources } from './data';

const referenced = new Set<string>();
export const digitalTopics = topics.map((topic) => {
  const entries = topic.measures.map((id) => {
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
      !['campagne', 'parti'].includes(source.kind) ||
      referenced.has(id)
    )
      throw new Error(`Fiche numérique invalide : ${id}`);
    referenced.add(id);
    return { measure, candidate, source };
  });
  return {
    ...topic,
    entries: entries.sort(
      (a, b) =>
        a.measure.title.localeCompare(b.measure.title, 'fr') ||
        a.measure.id.localeCompare(b.measure.id),
    ),
    candidateCount: new Set(entries.map((entry) => entry.candidate.id)).size,
  };
});
export const digitalCount = referenced.size;
export const digitalCandidates = new Set(
  digitalTopics.flatMap(({ entries }) =>
    entries.map(({ candidate }) => candidate.id),
  ),
).size;
