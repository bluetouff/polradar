import rows from '../data/digital-comparison.json';
import {
  digitalComparisonSchema,
  validateDigitalComparison,
} from './digital-comparison.mjs';
import {
  candidateById,
  dataset,
  measureById,
  sourceById,
  versions,
} from './data';

const comparison = digitalComparisonSchema.parse(rows);
const errors = validateDigitalComparison(comparison, dataset);
if (errors.length) throw new Error(errors.join('\n'));

export const digitalAxes = comparison.axes.map((axis) => {
  const rows = axis.rows.map((row) => ({
    ...row,
    entries: row.entries
      .map((entry) => {
        const version = versions.find(({ id }) => id === entry.versionId)!;
        const measure = measureById(version.measureId);
        return {
          ...entry,
          candidate: candidateById(measure.candidate),
          version,
          source: sourceById(version.snapshot.sourceRefs[0].sourceId),
        };
      })
      .filter((entry) => !entry.candidate.withdrawnOn),
  }));
  const profileIds = new Set(
    rows.flatMap((row) => row.entries.map((entry) => entry.candidate.id)),
  );
  const profiles = dataset.candidates.filter((candidate) =>
    profileIds.has(candidate.id),
  );
  return { ...axis, rows, profiles };
});
export const digitalParliament = comparison.parliament;
