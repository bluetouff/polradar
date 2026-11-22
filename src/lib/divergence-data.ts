import { attributionLabel } from './attribution.mjs';
import positionRows from '../data/divergence-positions.json';
import {
  activeCandidates,
  candidateById,
  dataset,
  measureById,
  versions,
  themes,
} from './data';
import { divergenceGroups } from './divergences.mjs';
import {
  positionsSchema,
  validateDivergencePositions,
} from './divergence-positions.mjs';

export const numericDivergences = divergenceGroups(
  dataset.measures.filter((m) => !candidateById(m.candidate).withdrawnOn),
  activeCandidates,
  themes,
);

const topics = positionsSchema.parse(positionRows);
const errors = validateDivergencePositions(
  topics,
  dataset,
  numericDivergences.map(({ id }) => id),
);
if (errors.length) throw new Error(errors.join('\n'));

const versionById = new Map(versions.map((version) => [version.id, version]));
export const positionDivergences = topics.map((topic) => {
  const positions = topic.positions
    .map(({ versions: ids, ...position }) => ({
      ...position,
      entries: ids
        .map((id) => {
          const version = versionById.get(id)!;
          const measure = measureById(version.measureId);
          const candidate = candidateById(measure.candidate);
          const author = attributionLabel(version.snapshot, candidate.name);
          return { candidate, measure, version, author };
        })
        .filter((entry) => !entry.candidate.withdrawnOn)
        .sort((left, right) => left.author.localeCompare(right.author, 'fr')),
    }))
    .filter((position) => position.entries.length);
  return {
    ...topic,
    themeLabel: themes.find(({ id }) => id === topic.theme)!.label,
    positions,
    total: positions.reduce(
      (count, position) => count + position.entries.length,
      0,
    ),
  };
});
