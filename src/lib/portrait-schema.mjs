import { z } from 'astro/zod';
import { idSchema, publicUrlSchema } from './schema.mjs';

export const portraitSchema = z
  .strictObject({
    candidate: idSchema,
    file: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpg|png)$/),
    author: z.string().min(1).max(300),
    license: z.enum([
      'CC0',
      'CC BY 2.0',
      'CC BY 3.0',
      'CC BY 4.0',
      'CC BY-SA 3.0',
      'CC BY-SA 4.0',
    ]),
    licenseUrl: publicUrlSchema,
    sourceUrl: publicUrlSchema,
    year: z
      .string()
      .regex(/^(?:19|20)\d{2}$/)
      .nullable(),
  })
  .superRefine((row, context) => {
    const source = new URL(row.sourceUrl),
      license = new URL(row.licenseUrl);
    const prefix =
      row.license === 'CC0'
        ? '/publicdomain/zero/1.0'
        : `/licenses/${row.license.includes('-SA') ? 'by-sa' : 'by'}/${row.license.split(' ').at(-1)}`;
    if (
      source.hostname !== 'commons.wikimedia.org' ||
      !source.pathname.startsWith('/wiki/File:')
    )
      context.addIssue({
        code: 'custom',
        message: 'Source du portrait non qualifiée',
      });
    if (
      license.hostname !== 'creativecommons.org' ||
      !(
        license.pathname === prefix || license.pathname.startsWith(prefix + '/')
      )
    )
      context.addIssue({ code: 'custom', message: 'Licence incohérente' });
    if (!row.file.startsWith(row.candidate + '.'))
      context.addIssue({
        code: 'custom',
        message: 'Portrait attribué à une autre candidature',
      });
    if (row.year && Number(row.year) > new Date().getUTCFullYear())
      context.addIssue({ code: 'custom', message: 'Date du portrait future' });
  });

export function parsePortraits(rows, candidates) {
  const parsed = portraitSchema.array().parse(rows);
  const known = new Set(candidates.map((candidate) => candidate.id)),
    seen = new Set();
  for (const row of parsed) {
    if (!known.has(row.candidate) || seen.has(row.candidate))
      throw new Error('Candidature inconnue ou portrait dupliqué');
    seen.add(row.candidate);
  }
  return parsed;
}
