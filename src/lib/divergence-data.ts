import positionRows from '../data/divergence-positions.json';
import { candidateById, dataset, measureById, versions, themes } from './data';
import { divergenceGroups } from './divergences.mjs';
import {
  positionsSchema,
  validateDivergencePositions,
} from './divergence-positions.mjs';

export const numericDivergences = divergenceGroups(
  dataset.measures,
  dataset.candidates,
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
export const positionDivergences = topics.map((topic) => ({
  ...topic,
  themeLabel: themes.find(({ id }) => id === topic.theme)!.label,
  total: topic.positions.reduce(
    (sum, position) => sum + position.versions.length,
    0,
  ),
  positions: topic.positions.map(({ versions: ids, ...position }) => ({
    ...position,
    entries: ids
      .map((id) => {
        const version = versionById.get(id)!;
        const measure = measureById(version.measureId);
        const candidate = candidateById(measure.candidate);
        const author = version.snapshot.partyAuthor ?? candidate.name;
        return { candidate, measure, version, author };
      })
      .sort((left, right) => left.author.localeCompare(right.author, 'fr')),
  })),
}));
