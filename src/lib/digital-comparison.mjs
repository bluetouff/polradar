import { z } from 'astro/zod';
import { dateSchema, idSchema, civilDateInParis } from './schema.mjs';

const text = z.string().trim().min(1).max(1000);
const count = z.number().int().nonnegative().max(577);
const axisId = z.enum(['cybersecurite', 'chiffrement', 'souverainete']);
const sourcesForVote = [
  'assemblee-resilience-scrutin-9794',
  'assemblee-resilience-amendement-358',
  'assemblee-resilience-seance-chiffrement',
];

export const digitalComparisonSchema = z.strictObject({
  axes: z
    .array(
      z.strictObject({
        id: axisId,
        title: text,
        description: text,
        icon: idSchema,
        rows: z
          .array(
            z.strictObject({
              id: idSchema,
              label: text,
              entries: z
                .array(
                  z.strictObject({
                    versionId: idSchema,
                    repere: text,
                    amountOnly: z.boolean().optional(),
                  }),
                )
                .min(2)
                .max(20),
            }),
          )
          .min(1)
          .max(6),
      }),
    )
    .length(3),
  parliament: z.strictObject({
    vote: z.strictObject({
      date: dateSchema,
      number: z.number().int().positive(),
      voters: count.positive(),
      expressed: count.positive(),
      for: count,
      against: count,
      abstained: count,
      sourceId: z.literal(sourcesForVote[0]),
      textSourceId: z.literal(sourcesForVote[1]),
      debateSourceId: z.literal(sourcesForVote[2]),
    }),
    statements: z
      .array(
        z.strictObject({
          author: text,
          group: text,
          position: z.enum(['Retirer l’article', 'Maintenir l’article']),
          description: text,
        }),
      )
      .min(2)
      .max(8),
    earlier: z.strictObject({
      date: dateSchema,
      sourceId: idSchema,
      description: text,
    }),
  }),
});

export const digitalComparePath = (id) =>
  id === 'cybersecurite'
    ? '/numerique/comparer/'
    : `/numerique/comparer/${id}/`;

export function validateDigitalComparison(config, dataset, now = new Date()) {
  const errors = [];
  const candidates = new Set(dataset.candidates.map(({ id }) => id));
  const versions = new Map(dataset.versions.map((row) => [row.id, row]));
  const measures = new Map(dataset.measures.map((row) => [row.id, row]));
  const sources = new Map(dataset.sources.map((row) => [row.id, row]));
  if (new Set(config.axes.map(({ id }) => id)).size !== 3)
    errors.push('Comparatif numérique : axes manquants ou en double.');
  for (const axis of config.axes) {
    if (new Set(axis.rows.map(({ id }) => id)).size !== axis.rows.length)
      errors.push(`${axis.id} : questions en double.`);
    for (const row of axis.rows) {
      const compared = new Set();
      for (const entry of row.entries) {
        const version = versions.get(entry.versionId);
        const measure = measures.get(version?.measureId);
        const source = sources.get(version?.snapshot.sourceRefs[0]?.sourceId);
        if (
          !measure ||
          !candidates.has(measure.candidate) ||
          version.snapshot.scope === 'archive' ||
          !['parti', 'campagne'].includes(source?.kind) ||
          (entry.amountOnly && !version.snapshot.amounts.length)
        ) {
          errors.push(
            `${axis.id}/${row.id} : version ou référence invalide (${entry.versionId}).`,
          );
          continue;
        }
        if (compared.has(measure.candidate))
          errors.push(
            `${axis.id}/${row.id} : profil en double (${measure.candidate}).`,
          );
        compared.add(measure.candidate);
      }
    }
  }
  const { vote, earlier } = config.parliament;
  if (
    vote.for + vote.against !== vote.expressed ||
    vote.expressed + vote.abstained !== vote.voters ||
    vote.for <= vote.expressed / 2
  )
    errors.push(
      'Scrutin sur l’article 16 bis : suffrages ou adoption incohérents.',
    );
  if (vote.date > civilDateInParis(now) || earlier.date >= vote.date)
    errors.push('Chiffrement des messageries : dates incohérentes.');
  for (const id of [...sourcesForVote, earlier.sourceId]) {
    const source = sources.get(id);
    if (
      source?.kind !== 'institution' ||
      ![
        'www.assemblee-nationale.fr',
        'questions.assemblee-nationale.fr',
      ].includes(new URL(source.url).hostname)
    )
      errors.push(
        `Chiffrement des messageries : référence institutionnelle invalide (${id}).`,
      );
  }
  return errors;
}
