import { z } from 'astro/zod';
import { idSchema, publicUrlSchema } from './schema.mjs';

// These permissions apply only to the reviewed photographs, not to their sites.
export const portraitPermissions = [
  {
    candidate: 'glucksmann',
    file: 'glucksmann.jpg',
    author: '© Union européenne 2024 · Source : Parlement européen',
    license: 'Conditions du Parlement européen',
    licenseUrl: 'https://www.europarl.europa.eu/legal-notice/en',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:1720448398743_20240708_GLUCKSMANN_Raphael_FR_006.jpg',
    year: '2024',
    identityUrl:
      'https://www.europarl.europa.eu/meps/fr/197694/RAPHAEL_GLUCKSMANN/home',
    note: 'Portrait institutionnel de juillet 2024. Réutilisation autorisée avec mention de la source. Le lien source donne accès au fichier complet ; Polradar le redimensionne et le recadre à l’affichage.',
  },
  {
    candidate: 'mathieu',
    file: 'mathieu.jpg',
    author: 'Delphine Herbin',
    license: 'Autorisation de campagne',
    licenseUrl: 'https://benoitmathieu2027.fr/presse/CREDITS-ET-CONDITIONS.txt',
    sourceUrl: 'https://benoitmathieu2027.fr/espace-presse',
    year: null,
    identityUrl: 'https://www.benoitmathieu2027.fr/',
    note: 'Photo : Delphine Herbin. Utilisation gratuite autorisée pour la communication liée à la campagne et à la candidature, les articles de presse et les publications sur les réseaux sociaux, avec crédit obligatoire. Recadrage et détourage autorisés ; toute autre modification est interdite. Polradar sert le JPEG fourni sans retouche ni réencodage et le recadre seulement à l’affichage. Ces conditions concernent uniquement ce portrait sur fond bleu.',
  },
];

export const portraitSchema = z
  .strictObject({
    candidate: idSchema,
    file: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpg|png)$/),
    author: z.string().min(1).max(300),
    title: z.string().min(1).max(500).optional(),
    license: z.enum([
      'CC0',
      'CC BY 2.0',
      'CC BY 3.0',
      'CC BY 4.0',
      'CC BY-SA 3.0',
      'CC BY-SA 4.0',
      'Conditions du Parlement européen',
      'Autorisation de campagne',
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
    const permission = portraitPermissions.find(
      (item) => item.candidate === row.candidate,
    );
    if (permission) {
      for (const field of [
        'file',
        'author',
        'license',
        'licenseUrl',
        'sourceUrl',
        'year',
      ]) {
        if (row[field] !== permission[field])
          context.addIssue({
            code: 'custom',
            message: 'Le portrait ne correspond pas à l’autorisation vérifiée',
          });
      }
    } else if (!row.license.startsWith('CC')) {
      context.addIssue({
        code: 'custom',
        message: 'Autorisation photographique non documentée',
      });
    } else {
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
          license.pathname === prefix ||
          license.pathname.startsWith(prefix + '/')
        )
      )
        context.addIssue({ code: 'custom', message: 'Licence incohérente' });
    }
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
