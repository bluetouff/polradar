import { z } from 'astro/zod';
import { civilDateInParis, idSchema } from './schema.mjs';

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
  const section = z
    .strictObject({
      id: z.enum(Object.keys(editorialSections)),
      status: z.enum(['consulte', 'partiel', 'indisponible']),
      note: z.string().trim().min(1).max(900),
      sources: z
        .array(idSchema.refine((id) => sourceIds.has(id), 'Source inconnue'))
        .min(1)
        .refine(unique),
      changes: z
        .array(
          z.strictObject({
            title: z.string().trim().min(1).max(200),
            path: localPage,
          }),
        )
        .refine((links) => unique(links.map((link) => link.path))),
    })
    .refine(
      (s) => s.status !== 'indisponible' || s.changes.length === 0,
      'Une recherche indisponible ne peut annoncer une publication',
    );
  const review = z.strictObject({
    checkedAt: z.iso
      .datetime({ offset: true })
      .refine(
        (at) => Date.parse(at) <= Date.now(),
        'Date de revue future ou invalide',
      ),
    collection: z
      .strictObject({
        run: z.string().regex(/^[1-9]\d{0,15}$/),
        attempt: z.number().int().positive(),
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
            .map((r) => civilDateInParis(new Date(r.checkedAt))),
        ),
      'Plusieurs revues pour la même journée de Paris',
    );
}
