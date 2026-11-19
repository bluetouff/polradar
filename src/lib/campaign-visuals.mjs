import { z } from 'astro/zod';
import { idSchema, dateSchema, publicUrlSchema } from './schema.mjs';
const text = z.string().min(1).max(1200);
const money = z.number().positive().max(1e13);
const entry = z
  .object({
    id: idSchema,
    label: text,
    euros: money,
    scope: z.enum(['campagne', 'parti']).optional(),
    eurosMax: money.optional(),
    kind: z.enum([
      'depense',
      'economie',
      'recette',
      'baisse-recette',
      'financement',
      'trajectoire',
    ]),
    period: z.enum([
      'annuel',
      'ponctuel',
      'pluriannuel',
      'horizon',
      'non-precise',
    ]),
    horizon: text,
    approximate: z.boolean(),
    funding: text.nullable(),
    source: idSchema,
    additionalSources: z.array(idSchema).min(1).max(5).optional(),
    locator: text,
    allocationUnit: z.enum(['euros', 'pourcentage']).nullable(),
    allocation: z.array(z.object({ label: text, value: money })).max(12),
    // An explicitly reviewed difference in the source is never a balancing item.
    allocationDifference: z
      .strictObject({
        euros: z
          .number()
          .min(-1e13)
          .max(1e13)
          .refine((n) => n !== 0),
        note: text,
      })
      .optional(),
  })
  .superRefine((row, ctx) => {
    const fail = (message) => ctx.addIssue({ code: 'custom', message });
    if (
      row.eurosMax !== undefined &&
      (row.eurosMax <= row.euros || row.allocation.length)
    )
      fail('Fourchette incohérente ou répartition non déterminée');
    const refs = [row.source, ...(row.additionalSources ?? [])];
    if (new Set(refs).size !== refs.length) fail('Source dupliquée');
    if (Boolean(row.allocation.length) !== (row.allocationUnit !== null))
      fail('Unité de répartition manquante');
    if (row.allocation.length) {
      const sum = row.allocation.reduce((n, p) => n + p.value, 0);
      const total = row.allocationUnit === 'euros' ? row.euros : 100;
      const difference = sum - total;
      if (row.allocationDifference) {
        if (
          row.allocationUnit !== 'euros' ||
          Math.abs(difference) <= 0.001 ||
          Math.abs(difference - row.allocationDifference.euros) > 0.001
        )
          fail('Écart de source incohérent');
      } else if (Math.abs(difference) > 0.001)
        fail('Répartition non réconciliée');
      if (row.approximate && row.allocationUnit === 'euros')
        fail('Ne pas donner une précision absente de la source');
    } else if (row.allocationDifference) fail('Écart sans répartition');
  });
export const programmeBudgetSchema = z
  .object({
    version: z.literal(1),
    checked: dateSchema,
    profiles: z
      .array(
        z.object({
          candidate: idSchema,
          scope: z.enum(['campagne', 'parti']),
          note: text,
          entries: z.array(entry).min(1).max(30),
        }),
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    if (
      new Set(data.profiles.map((p) => p.candidate)).size !==
      data.profiles.length
    )
      ctx.addIssue({ code: 'custom', message: 'Profil dupliqué' });
    const ids = data.profiles.flatMap((p) => p.entries.map((e) => e.id));
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'Montant dupliqué' });
  });
const point = z.tuple([z.number().min(-6).max(10), z.number().min(41).max(52)]);
export const agendaSchema = z
  .object({
    version: z.literal(1),
    checked: dateSchema,
    cities: z.array(
      z.object({
        id: idSchema,
        name: text,
        code: z.string().regex(/^\d{5}$/),
        coordinates: point,
        sourceUrl: publicUrlSchema.refine(
          (s) => new URL(s).hostname === 'geo.api.gouv.fr',
        ),
      }),
    ),
    events: z
      .array(
        z.object({
          id: idSchema,
          candidate: idSchema,
          date: dateSchema,
          time: z
            .string()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
            .nullable(),
          timezone: z.literal('Europe/Paris'),
          city: idSchema.nullable(),
          title: text,
          venue: text.nullable(),
          note: z.string().max(1200),
          source: idSchema,
          status: z.enum(['annonce', 'annule']),
        }),
      )
      .max(1000),
  })
  .superRefine((data, ctx) => {
    const fail = (message) => ctx.addIssue({ code: 'custom', message });
    const cities = new Set(data.cities.map((c) => c.id));
    if (
      cities.size !== data.cities.length ||
      new Set(data.events.map((e) => e.id)).size !== data.events.length
    )
      fail('Doublon dans l’agenda');
    for (const e of data.events)
      if (e.city && !cities.has(e.city)) fail('Commune inconnue');
  });
export const mapSchema = z.object({
  sourceUrl: publicUrlSchema,
  licenseUrl: publicUrlSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  rings: z.array(z.array(point).min(4).max(10000)).min(1).max(100),
});
export function validateVisualReferences(budgets, agenda, candidates, sources) {
  const errors = [],
    people = new Set(candidates.map((c) => c.id)),
    refs = new Set(sources.map((s) => s.id));
  for (const p of budgets.profiles) {
    if (!people.has(p.candidate))
      errors.push(`Budget : candidat inconnu ${p.candidate}`);
    for (const e of p.entries)
      for (const ref of [e.source, ...(e.additionalSources ?? [])])
        if (!refs.has(ref)) errors.push(`Budget : source inconnue ${ref}`);
  }
  for (const e of agenda.events) {
    if (!people.has(e.candidate))
      errors.push(`Agenda : candidat inconnu ${e.candidate}`);
    if (!refs.has(e.source))
      errors.push(`Agenda : source inconnue ${e.source}`);
  }
  return errors;
}
