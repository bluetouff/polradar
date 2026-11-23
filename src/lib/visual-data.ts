import airtimeRows from '../data/airtime.json';
import budgetRows from '../data/programme-budgets.json';
import agendaRows from '../data/campaign-agenda.json';
import mapRows from '../data/france-map.json';
import { airtimeSchema } from './airtime.mjs';
import {
  programmeBudgetSchema,
  agendaSchema,
  mapSchema,
  validateVisualReferences,
} from './campaign-visuals.mjs';
import { candidates, versions, sources, measures, candidateById } from './data';
import { attributionLabel } from './attribution.mjs';

export const airtime = airtimeSchema.parse(airtimeRows);
export const programmeBudgets = programmeBudgetSchema.parse(budgetRows);
export const agenda = agendaSchema.parse(agendaRows);
export const franceMap = mapSchema.parse(mapRows);
const errors = validateVisualReferences(
  programmeBudgets,
  agenda,
  candidates,
  sources,
  versions,
);
if (errors.length) throw new Error(errors.join('\n'));

const versionById = new Map(versions.map((v) => [v.id, v]));
const measureById = new Map(measures.map((m) => [m.id, m]));
export const budgetAssessments = programmeBudgets.profiles.flatMap((profile) =>
  profile.entries.map((entry) => {
    const { review, ...amount } = entry;
    return {
      ...amount,
      currency: 'EUR',
      dossier: profile.candidate,
      scope: entry.scope ?? profile.scope,
      status: review?.status ?? 'a-examiner',
      reviewedOn: review?.checked ?? null,
      estimator: review?.estimator ?? null,
      origin: review?.origin ?? null,
      publicScope: review?.publicScope ?? null,
      priceYear: review?.priceYear ?? null,
      grossNet: review?.grossNet ?? null,
      assumptions: review?.assumptions ?? null,
      overlaps: review?.overlaps ?? [],
      targets: (review?.targets ?? []).map((target) => {
        const v = versionById.get(target.versionId)!;
        const m = measureById.get(v.measureId)!;
        return {
          ...target,
          measureId: m.id,
          number: v.number,
          title: v.snapshot.title,
          author: attributionLabel(v.snapshot, candidateById(m.candidate).name),
          href: `/mesures/${m.id}/#version-${v.number}`,
        };
      }),
    };
  }),
);
export const budgetById = new Map(budgetAssessments.map((b) => [b.id, b]));
export const budgetIdsByMeasure = new Map<string, string[]>();
for (const row of budgetAssessments) {
  for (const id of new Set(row.targets.map((t) => t.measureId))) {
    const previous = budgetIdsByMeasure.get(id) ?? [];
    budgetIdsByMeasure.set(id, [...previous, row.id]);
  }
}
