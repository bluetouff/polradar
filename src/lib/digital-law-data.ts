import rows from '../data/digital-law.json';
import {
  candidateById,
  dataset,
  measureById,
  sourceById,
  versions,
} from './data';
import {
  digitalLawSchema,
  digitalLawPath,
  validateDigitalLaw,
} from './digital-law.mjs';

const law = digitalLawSchema.parse(rows);
const errors = validateDigitalLaw(law, dataset);
if (errors.length) throw new Error(errors.join('\n'));

export const digitalLawAsOf = law.asOf;
const versionById = new Map(versions.map((version) => [version.id, version]));
type LawRule = (typeof law.sections)[number]['cases'][number]['rules'][number];
const resolveRule = (rule: LawRule) => ({
  ...rule,
  refs: rule.refs.map((ref) => ({
    ...ref,
    url: sourceById(ref.sourceId).url,
  })),
});

export const digitalLawSections = law.sections.map((section) => ({
  ...section,
  cases: section.cases.map((item) => ({
    ...item,
    href: digitalLawPath(item.slug),
    rules: item.rules.map(resolveRule),
    parliament: item.parliament
      ? { ...item.parliament, ...resolveRule(item.parliament) }
      : undefined,
    changes: item.changes.map((change) => {
      const version = versionById.get(change.versionId)!;
      const candidate = candidateById(measureById(version.measureId).candidate);
      const snapshot = version.snapshot;
      return {
        ...change,
        author: snapshot.scope === 'parti' ? candidate.party : candidate.name,
        scope: snapshot.scope,
        edition: snapshot.edition,
        sources: snapshot.sourceRefs.map((ref) => ({
          ...ref,
          source: sourceById(ref.sourceId),
        })),
        detailHref: `/mesures/${version.measureId}/#version-${version.number}`,
      };
    }),
  })),
}));
