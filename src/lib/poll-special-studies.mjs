import { z } from 'astro/zod';
import { dateSchema, publicUrlSchema } from './schema.mjs';
import { commissionIndex, noticeUrl } from './poll-catalogue.mjs';

const label = z.string().trim().min(1).max(350);
const count = z.number().int().positive();
const page = count.max(1000);
const commissionOrigin = new URL(commissionIndex).origin;
const pdfUrl = publicUrlSchema.refine((value) => {
  const url = new URL(value);
  return (
    url.origin === commissionOrigin &&
    /^\/notices\/files\/notices\/\d{4}\/[^/]+\/[^/]+\.pdf$/i.test(
      url.pathname,
    ) &&
    !url.search &&
    !url.hash
  );
});
const table = z.strictObject({
  title: label,
  page,
  questionPage: page.optional(),
  question: label,
  base: label,
  note: label.optional(),
  results: z
    .array(z.strictObject({ label, percentage: z.number().min(0).max(100) }))
    .min(2)
    .max(40)
    .refine((rows) => new Set(rows.map((r) => r.label)).size === rows.length),
});
const study = z
  .strictObject({
    downloadId: z.string().regex(/^[1-9][0-9]{0,6}$/),
    number: z.string().regex(/^\d{4,6}[a-z]?$/),
    category: z.enum(['choix-de-vote', 'opinion']),
    title: label,
    institute: label,
    commissioner: label,
    fieldworkStart: dateSchema,
    fieldworkEnd: dateSchema,
    population: label,
    method: label,
    methodPage: page,
    pdfUrl,
    scope: label,
    publication: z
      .strictObject({
        label,
        url: publicUrlSchema,
        date: dateSchema.optional(),
      })
      .optional(),
    tables: z.array(table).min(1).max(100),
  })
  .refine(
    (s) =>
      s.fieldworkStart <= s.fieldworkEnd &&
      (!s.publication?.date || s.publication.date >= s.fieldworkEnd) &&
      new Set(s.tables.map((t) => t.title)).size === s.tables.length,
    'Dates ou tables de l’enquête incohérentes',
  );

/** @param {unknown} raw @param {ReturnType<import('./poll-catalogue.mjs').catalogueCoverage>} notices */
export function documentedSpecialStudies(raw, notices) {
  const published = new Map(
    notices
      .filter((r) => r.status === 'hors_series')
      .map((r) => [r.downloadId, r]),
  );
  const rows = study.array().max(300).parse(raw);
  if (
    published.size !== rows.length ||
    new Set(rows.map((r) => r.downloadId)).size !== rows.length
  )
    throw Error('Enquêtes hors séries incohérentes avec le catalogue');
  return rows.map((row) => {
    const notice = published.get(row.downloadId);
    const evidence = new Set(notice?.audit?.evidencePages);
    if (
      !notice ||
      !notice.audit ||
      notice.number !== row.number ||
      !evidence.has(row.methodPage) ||
      row.tables.some(
        (table) =>
          !evidence.has(table.page) ||
          (table.questionPage !== undefined &&
            !evidence.has(table.questionPage)),
      )
    )
      throw Error('Table sans page relue dans la notice ' + row.number);
    return {
      ...row,
      url: noticeUrl(row.downloadId),
      sha256: notice.audit.sha256,
    };
  });
}
