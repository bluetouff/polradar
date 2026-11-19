import { z } from 'astro/zod';
import { civilDateInParis, dateSchema, idSchema } from './schema.mjs';

const text = z.string().trim().min(1).max(1200);
const reference = z.strictObject({ sourceId: idSchema, label: text });
const rule = z.strictObject({
  title: text,
  body: text,
  refs: z.array(reference).min(1).max(4),
});

export const digitalLawSchema = z.strictObject({
  asOf: dateSchema,
  sections: z
    .array(
      z.strictObject({
        id: idSchema,
        title: text,
        icon: idSchema,
        cases: z
          .array(
            z.strictObject({
              id: idSchema,
              slug: z.union([
                z.literal(''),
                idSchema,
                z.templateLiteral([idSchema, '/', idSchema]),
              ]),
              label: text,
              question: text,
              context: text,
              icon: idSchema,
              rules: z.array(rule).min(1).max(4),
              changes: z
                .array(
                  z.strictObject({
                    versionId: idSchema,
                    title: text,
                    body: text,
                  }),
                )
                .max(4),
              parliament: rule
                .extend({
                  stages: z
                    .array(z.strictObject({ date: dateSchema, label: text }))
                    .min(2)
                    .max(5)
                    .optional(),
                })
                .optional(),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .min(1)
    .max(4),
});

export const digitalLawRoot = '/numerique/ce-qui-changerait/';
export const digitalLawPath = (slug) =>
  slug ? `${digitalLawRoot}${slug}/` : digitalLawRoot;

export function validateDigitalLaw(config, dataset, now = new Date()) {
  const errors = [];
  const sources = new Map(dataset.sources.map((row) => [row.id, row]));
  const measures = new Map(dataset.measures.map((row) => [row.id, row]));
  const versions = new Map(dataset.versions.map((row) => [row.id, row]));
  const caseIds = new Set();
  const slugs = new Set();
  const sectionIds = new Set();
  if (config.asOf > civilDateInParis(now))
    errors.push('Numérique et droit en vigueur : date de consultation future.');
  for (const section of config.sections) {
    if (sectionIds.has(section.id))
      errors.push(
        `Numérique et droit en vigueur : section en double (${section.id}).`,
      );
    sectionIds.add(section.id);
    for (const item of section.cases) {
      if (caseIds.has(item.id) || slugs.has(item.slug))
        errors.push(`${item.id} : situation ou adresse en double.`);
      caseIds.add(item.id);
      slugs.add(item.slug);
      if (!item.changes.length && !item.parliament)
        errors.push(
          `${item.id} : proposition ou texte parlementaire manquant.`,
        );
      for (const { refs } of [
        ...item.rules,
        ...(item.parliament ? [item.parliament] : []),
      ]) {
        for (const { sourceId } of refs) {
          const source = sources.get(sourceId);
          if (
            source?.kind !== 'institution' ||
            (source.published && source.published > config.asOf)
          )
            errors.push(
              `${item.id} : référence juridique invalide (${sourceId}).`,
            );
        }
      }
      const stages = item.parliament?.stages ?? [];
      if (
        stages.some(
          ({ date }, index) =>
            date > config.asOf || (index > 0 && date <= stages[index - 1].date),
        )
      )
        errors.push(`${item.id} : étapes parlementaires non chronologiques.`);
      const seen = new Set();
      for (const change of item.changes) {
        const version = versions.get(change.versionId);
        const measure = measures.get(version?.measureId);
        const snapshot = version?.snapshot;
        if (
          !measure ||
          !snapshot ||
          !['parti', 'campagne', 'orientation'].includes(snapshot.scope) ||
          version.observedOn > config.asOf ||
          !snapshot.sourceRefs.length ||
          snapshot.sourceRefs.some(
            ({ sourceId }) =>
              !['parti', 'campagne'].includes(sources.get(sourceId)?.kind),
          )
        )
          errors.push(
            `${item.id} : version officielle invalide (${change.versionId}).`,
          );
        if (seen.has(change.versionId))
          errors.push(`${item.id} : version en double (${change.versionId}).`);
        seen.add(change.versionId);
      }
    }
  }
  if (!slugs.has(''))
    errors.push(
      'Numérique et droit en vigueur : situation d’entrée manquante.',
    );
  return errors;
}
