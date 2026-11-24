import { z } from 'astro/zod';
import { dateSchema, idSchema, publicUrlSchema } from './schema.mjs';

const evidenceSchema = z.record(
  idSchema,
  z.strictObject({
    media: z.string().trim().min(1).max(160),
    date: dateSchema,
    localTime: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    sourceId: idSchema,
    documentUrl: publicUrlSchema.optional(),
    page: z.number().int().min(1).max(2000),
    checked: dateSchema,
  }),
);
const unknown = /** @type {const} */ ({ status: 'inconnue' });
/** @typedef {Omit<z.infer<typeof evidenceSchema>[string], 'documentUrl'> & {status: 'verifiee', sourceUrl: string}} VerifiedPublication */

/**
 * Only an explicit first-publication statement establishes the medium and date.
 * @template {{surveyId?: string, noticeSource: string, resultSource?: string, fieldworkEnd: string}} P
 * @param {P[]} polls
 * @param {unknown} evidence
 * @param {{id: string, url: string}[]} sources
 * @param {string} today
 */
export function withFirstPublications(polls, evidence, sources, today) {
  const entries = evidenceSchema.parse(evidence);
  /** @type {Map<string, VerifiedPublication>} */
  const publications = new Map();
  for (const [survey, { documentUrl, ...row }] of Object.entries(entries)) {
    const waves = polls.filter((p) => p.surveyId === survey);
    const source = sources.find((s) => s.id === row.sourceId);
    if (
      !waves.length ||
      !source ||
      waves.some(
        (p) =>
          p.fieldworkEnd > row.date ||
          ![p.noticeSource, p.resultSource].includes(row.sourceId),
      ) ||
      row.checked < row.date ||
      row.checked > today
    )
      throw Error('Première diffusion incohérente pour l’enquête ' + survey);
    const url = new URL(publicUrlSchema.parse(documentUrl ?? source.url));
    if (url.origin !== new URL(source.url).origin)
      throw Error(
        'Document de première diffusion hors du domaine de la source',
      );
    url.hash = 'page=' + row.page;
    publications.set(survey, {
      status: /** @type {const} */ ('verifiee'),
      ...row,
      sourceUrl: url.href,
    });
  }
  return polls.map((p) => ({
    ...p,
    firstPublication: publications.get(p.surveyId ?? '') ?? unknown,
  }));
}
