import { z } from 'astro/zod';
import {
  civilDateInParis,
  idSchema,
  publicUrlSchema,
  dateSchema,
} from './schema.mjs';

export const editorialLead = z.strictObject({
  title: z
    .string()
    .min(2)
    .max(220)
    .regex(/^[^<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]*$/u),
  date: dateSchema,
  article: z
    .string()
    .regex(/^[A-Za-z0-9_-]{12,800}$/)
    .nullable(),
  publisher: z.string().regex(/^[a-z0-9.-]{3,180}$/),
});

export const editorialSections = {
  candidatures: 'Candidatures et investitures',
  propositions: 'Propositions, comparaisons et évolutions',
  agenda: 'Meetings et déplacements',
  breves: 'Brèves, chronologie et dossiers',
  votes: 'Votes parlementaires',
  financements: 'Budgets et financements',
  droit: 'Droit en vigueur et calendrier électoral',
  reperes: 'Résultats territoriaux, archives et échiquier politique',
  donnees: 'Sondages, économie, marchés et temps de parole',
  declarations: 'Vérification des déclarations',
};

const unique = (values) => new Set(values).size === values.length;
const localPage = z
  .string()
  .max(250)
  .regex(
    /^\/(?:[a-z0-9-]+\/)*(?:#[a-z0-9][a-z0-9=-]*)?$/,
    'Une publication doit renvoyer à une page de Polradar',
  );

export function editorialReviewSchema(candidates, sources) {
  const candidateIds = new Set(candidates.map((c) => c.id));
  const sourceIds = new Set(sources.map((s) => s.id));
  const source = idSchema.refine((id) => sourceIds.has(id), 'Source inconnue');
  const publication = z.strictObject({
    title: z.string().trim().min(1).max(300),
    path: localPage,
  });
  const runNumber = z.string().regex(/^[1-9]\d{0,15}$/);
  const section = z
    .strictObject({
      id: z.enum(Object.keys(editorialSections)),
      status: z.enum(['consulte', 'partiel', 'indisponible']),
      note: z.string().trim().min(1).max(900),
      sources: z.array(source).min(1).refine(unique),
      changes: z
        .array(publication)
        .refine((links) => unique(links.map((link) => link.path))),
    })
    .refine(
      (s) => s.status !== 'indisponible' || s.changes.length === 0,
      'Une recherche indisponible ne peut annoncer une publication',
    );
  const review = z.strictObject({
    scope: z.literal('annonces').optional(),
    checkedAt: z.iso
      .datetime({ offset: true })
      .refine(
        (at) => Date.parse(at) <= Date.now(),
        'Date de revue future ou invalide',
      ),
    collection: z
      .strictObject({
        run: runNumber,
        attempt: z.number().int().positive(),
      })
      .optional(),
    manualCheckedAt: z.iso.datetime({ offset: true }).optional(),
    hosted: z
      .strictObject({
        run: runNumber,
        attempt: z.number().int().positive(),
        since: z.iso.date(),
        queries: z
          .array(
            z.strictObject({
              id: idSchema.refine(
                (id) =>
                  candidateIds.has(id) || Object.hasOwn(editorialSections, id),
              ),
              count: z.number().int().min(0).max(150).nullable(),
              engine: z.enum(['google', 'bing']).nullable(),
              leads: z.array(editorialLead).max(2),
            }),
          )
          .max(500)
          .refine((rows) => unique(rows.map((row) => row.id))),
        checks: z
          .array(
            z.strictObject({
              id: source,
              ok: z.boolean(),
              issues: z
                .array(
                  z.enum([
                    'flux-indisponible',
                    'article-indisponible',
                    'limite-editeur',
                  ]),
                )
                .max(3)
                .optional(),
              url: publicUrlSchema.nullable(),
            }),
          )
          .max(1000)
          .refine((rows) => unique(rows.map((row) => row.id))),
        publications: z.array(source).max(800).refine(unique),
        changes: z.array(publication).max(800),
      })
      .optional(),
    candidates: z
      .array(idSchema.refine((id) => candidateIds.has(id), 'Candidat inconnu'))
      .refine(unique),
    sections: z
      .array(section)
      .min(1)
      .refine((rows) => unique(rows.map((r) => r.id)), 'Rubrique en double'),
  });
  return z
    .array(review)
    .refine(
      (entries) =>
        unique(
          entries
            .filter((r) => Number.isFinite(Date.parse(r.checkedAt)))
            .map((r) =>
              r.hosted
                ? r.hosted.run + '/' + r.hosted.attempt
                : civilDateInParis(new Date(r.checkedAt)) +
                  '/' +
                  (r.scope ?? 'complete'),
            ),
        ),
      'Exécution déjà consignée ou deux revues manuelles du même type le même jour',
    );
}

/** @template {{checkedAt: string, hosted?: {checks: {id: string, ok: boolean}[]}}} Report
 * @param {Report[]} reports
 */
export function editorialRunsByDay(reports) {
  /** @type {Map<string, Report[]>} */
  const days = new Map();
  for (const report of [...reports].sort(
    (a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt),
  )) {
    const day = civilDateInParis(new Date(report.checkedAt));
    const runs = days.get(day) ?? [];
    runs.push(report);
    days.set(day, runs);
  }
  return days;
}

/** @param {{hosted?: {checks: {id: string, ok: boolean}[]}}[]} runs */
export function editorialDayAccess(runs) {
  const visited = new Set();
  const accessible = new Set();
  for (const run of runs) {
    for (const check of run.hosted?.checks ?? []) {
      visited.add(check.id);
      if (check.ok) accessible.add(check.id);
    }
  }
  return { checked: visited.size, accessible: accessible.size };
}

export const editorialIssueLabels = {
  'flux-indisponible': 'flux indisponible',
  'article-indisponible': 'article indisponible',
  'limite-editeur': 'attente demandée par le site',
};
