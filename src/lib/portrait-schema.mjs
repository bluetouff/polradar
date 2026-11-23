import { z } from 'astro/zod';
import { idSchema, publicUrlSchema } from './schema.mjs';
import { portraitLinks } from './portrait-links.mjs';

export const unconfirmedRights = 'Autorisation de reproduction non documentée';

// These permissions apply only to the reviewed photographs, not to their sites.
export const portraitPermissions = [
  {
    candidate: 'collovati',
    file: 'collovati.jpg',
    author: 'Photographe non indiqué',
    license: 'Autorisation d’affichage sur Polradar',
    licenseUrl: null,
    sourceUrl: 'https://www.xn--lepeuplefranais2027-hyb.fr/',
    year: null,
    identityUrl: 'https://www.xn--lepeuplefranais2027-hyb.fr/',
    note: 'Christian Collovati a autorisé le 20 novembre 2026 l’utilisation sur Polradar du portrait publié sur son site. Son accord porte sur cette photographie. Les droits de réutilisation par des tiers restent à préciser.',
  },
  {
    candidate: 'villepin',
    file: 'villepin.jpg',
    author: 'Service photographique de Matignon',
    license: 'Licence Ouverte 1.0',
    licenseUrl: 'https://www.data.gouv.fr/pages/legal/licences/etalab-1-0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:De_Villepin_PM_portrait.png',
    year: '2005',
    identityUrl:
      'https://www.info.gouv.fr/les-anciens-premiers-et-premieres-ministres-de-la-ve-republique/dominique-de-villepin',
    note: 'Portrait institutionnel de 2005, recadré par Polradar. Le fichier original est accessible sur Wikimedia Commons.',
  },
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
      'Licence Ouverte 1.0',
      'Conditions du Parlement européen',
      'Autorisation de campagne',
      'Autorisation d’affichage sur Polradar',
      unconfirmedRights,
    ]),
    licenseUrl: publicUrlSchema.nullable(),
    sourceUrl: publicUrlSchema,
    year: z
      .string()
      .regex(/^(?:19|20)\d{2}$/)
      .nullable(),
  })
  .superRefine((row, context) => {
    const source = new URL(row.sourceUrl);
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
    } else if (row.license === unconfirmedRights) {
      const publication = Object.hasOwn(portraitLinks, row.candidate)
        ? portraitLinks[row.candidate]
        : undefined;
      if (
        !publication ||
        row.licenseUrl !== null ||
        row.sourceUrl !== (publication.sourceUrl ?? publication.url)
      )
        context.addIssue({
          code: 'custom',
          message:
            'La publication du portrait doit être identifiée sans licence de reprise',
        });
    } else if (!row.license.startsWith('CC') || !row.licenseUrl) {
      context.addIssue({
        code: 'custom',
        message: 'Autorisation photographique non documentée',
      });
    } else {
      const license = new URL(row.licenseUrl);
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
