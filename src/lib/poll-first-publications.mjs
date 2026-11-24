import { z } from 'astro/zod';
import { dateSchema, idSchema, publicUrlSchema } from './schema.mjs';

const localTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const documentLabels = {
  article: 'Article',
  'publication-institut': 'Publication de l’institut',
  rapport: 'Rapport',
  notice: 'Notice',
  'horaire-annonce': 'Diffusion prévue dans la notice',
};
const traceSchema = z.record(
  idSchema,
  z.strictObject({
    noticeSource: idSchema,
    checked: dateSchema,
    documents: z
      .array(
        z.strictObject({
          kind: z.enum([
            'article',
            'publication-institut',
            'rapport',
            'notice',
            'horaire-annonce',
          ]),
          publisher: z.string().trim().min(1).max(160),
          url: publicUrlSchema,
          date: dateSchema.optional(),
          localTime: localTime.optional(),
          page: z.number().int().min(1).max(2000).optional(),
        }),
      )
      .min(1)
      .max(5),
  }),
);
const evidenceSchema = z.record(
  idSchema,
  z.strictObject({
    media: z.string().trim().min(1).max(160),
    date: dateSchema,
    localTime: localTime.optional(),
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
 * @param {unknown} [documents]
 */
export function withFirstPublications(
  polls,
  evidence,
  sources,
  today,
  documents = {},
) {
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
  const traces = traceSchema.parse(documents);
  /** @typedef {z.infer<typeof traceSchema>[string]['documents'][number] & {label: string, checked: string}} Trace */
  /** @type {Map<string, Trace[]>} */
  const links = new Map();
  for (const [survey, batch] of Object.entries(traces)) {
    const waves = polls.filter((p) => p.surveyId === survey);
    const source = sources.find((s) => s.id === batch.noticeSource);
    if (
      !source ||
      !waves.length ||
      waves.some(
        (p) =>
          p.noticeSource !== batch.noticeSource ||
          p.fieldworkEnd > batch.checked,
      ) ||
      batch.checked > today
    ) {
      throw Error('Documents sans enquête ou notice concordante : ' + survey);
    }
    const seen = new Set();
    const linked = batch.documents.map((doc) => {
      const url = new URL(doc.url);
      const fromNotice =
        doc.kind === 'notice' || doc.kind === 'horaire-annonce';
      const file = fromNotice || doc.kind === 'rapport';
      if (
        seen.has(doc.url) ||
        url.hash ||
        (fromNotice && url.origin !== new URL(source.url).origin) ||
        file !== Boolean(doc.page) ||
        ((!file || doc.kind === 'horaire-annonce' || doc.localTime) &&
          !doc.date) ||
        (doc.date &&
          (doc.date > batch.checked ||
            waves.some((p) => p.fieldworkEnd > doc.date)))
      ) {
        throw Error('Référence de publication incohérente : ' + survey);
      }
      seen.add(doc.url);
      if (doc.page) url.hash = 'page=' + doc.page;
      return {
        ...doc,
        url: url.href,
        label: documentLabels[doc.kind],
        checked: batch.checked,
      };
    });
    links.set(survey, linked);
  }
  return polls.map((p) => ({
    ...p,
    publicationDocuments: links.get(p.surveyId ?? '') ?? [],
    firstPublication: publications.get(p.surveyId ?? '') ?? unknown,
  }));
}
