import { z } from 'astro/zod';

export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, 'Date civile invalide');
export const publicUrlSchema = z
  .url()
  .max(1500)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname.includes('.') &&
      !/^[\d.]+$/.test(url.hostname) &&
      !url.hostname.includes(':') &&
      !/\.(local|internal|localhost)$/.test(url.hostname)
    );
  }, 'Une source doit être une URL HTTPS publique, sans identifiants');
const text = z.string().min(1).max(3000);
export const sourceSchema = z.object({
  id: idSchema,
  title: text,
  url: publicUrlSchema,
  kind: z.enum(['campagne', 'parti', 'institution', 'presse', 'archive']),
  published: dateSchema.nullable(),
  checked: dateSchema,
});
export const candidateSchema = z.object({
  id: idSchema,
  name: text,
  party: text,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  status: text,
  note: text,
  statusSource: idSchema,
});
export const themeSchema = z.object({
  id: idSchema,
  label: text,
  short: text,
  note: text,
});
export const engagementSchema = z.object({
  id: idSchema,
  candidate: idSchema,
  theme: idSchema,
  title: text,
  bullets: z.array(text).min(1).max(12),
  sources: z.array(idSchema).min(1),
  scope: z.enum(['campagne', 'parti', 'orientation', 'archive']),
  edition: text,
  note: z.string().max(3000),
  checked: dateSchema,
  history: z
    .array(z.object({ date: dateSchema, event: text, summary: text }))
    .min(1),
});
export const eventSchema = z.object({
  id: idSchema,
  date: dateSchema,
  title: text,
  description: text,
  kind: z.enum(['past', 'announced']),
  sources: z.array(idSchema).min(1),
});
export const pollSchema = z.object({
  id: idSchema,
  institute: text,
  commissioner: text,
  published: dateSchema,
  fieldworkStart: dateSchema,
  fieldworkEnd: dateSchema,
  sampleSize: z.number().int().positive(),
  usefulSample: z.number().int().positive().nullable(),
  scenario: text,
  noticeSource: idSchema,
  results: z
    .array(z.object({ name: text, percentage: z.number().min(0).max(100) }))
    .min(2)
    .max(40),
  uncertainty: text,
});

/** @param {Record<string, any>} dataset */
export function validateDataset(dataset) {
  const errors = [];
  const schemas = {
    sources: sourceSchema,
    candidates: candidateSchema,
    themes: themeSchema,
    engagements: engagementSchema,
    events: eventSchema,
    polls: pollSchema,
  };
  for (const [name, schema] of Object.entries(schemas)) {
    const rows = dataset[name];
    if (!Array.isArray(rows)) {
      errors.push(`${name}: tableau manquant`);
      continue;
    }
    const seen = new Set();
    for (const row of rows) {
      const result = schema.safeParse(row);
      if (!result.success)
        errors.push(`${name}/${row?.id}: ${result.error.message}`);
      if (seen.has(row?.id))
        errors.push(`${name}: identifiant dupliqué ${row?.id}`);
      seen.add(row?.id);
    }
  }
  if (errors.length) return errors;
  const sourceIds = new Set(dataset.sources.map((s) => s.id));
  const candidateIds = new Set(dataset.candidates.map((c) => c.id));
  const themeIds = new Set(dataset.themes.map((t) => t.id));
  const pairs = new Set();
  const today = new Date().toISOString().slice(0, 10);
  const metadata = z
    .object({ edition: dateSchema, corpusUpdated: dateSchema })
    .safeParse(dataset.meta);
  if (!metadata.success) errors.push('meta: dates manquantes ou invalides');
  else if (
    metadata.data.edition > today ||
    metadata.data.corpusUpdated > metadata.data.edition
  )
    errors.push('meta: dates de corpus ou d’édition incohérentes');
  for (const source of dataset.sources) {
    if (source.checked > today)
      errors.push(`${source.id}: consultation future`);
    if (source.published && source.published > source.checked)
      errors.push(`${source.id}: publication après consultation`);
  }
  for (const candidate of dataset.candidates) {
    if (!sourceIds.has(candidate.statusSource))
      errors.push(`${candidate.id}: statut sans source existante`);
  }
  for (const item of dataset.engagements) {
    if (item.checked > today) errors.push(`${item.id}: consultation future`);
    if (!candidateIds.has(item.candidate))
      errors.push(`${item.id}: candidature inconnue`);
    if (!themeIds.has(item.theme)) errors.push(`${item.id}: thème inconnu`);
    const pair = `${item.candidate}|${item.theme}`;
    if (pairs.has(pair)) errors.push(`${item.id}: doublon candidat/thème`);
    pairs.add(pair);
    for (const id of item.sources)
      if (!sourceIds.has(id)) errors.push(`${item.id}: source inconnue ${id}`);
    if (item.scope === 'archive' && !/2022/.test(item.edition))
      errors.push(`${item.id}: millésime d’archive manquant`);
    let previous = '';
    for (const version of item.history) {
      if (version.date < previous)
        errors.push(`${item.id}: historique non chronologique`);
      if (version.date > item.checked)
        errors.push(`${item.id}: historique après consultation`);
      previous = version.date;
    }
  }
  for (const event of dataset.events)
    for (const id of event.sources) {
      if (!sourceIds.has(id)) errors.push(`${event.id}: source inconnue ${id}`);
    }
  for (const poll of dataset.polls) {
    if (poll.published > today) errors.push(`${poll.id}: publication future`);
    if (
      new Set(poll.results.map((item) => item.name)).size !==
      poll.results.length
    )
      errors.push(`${poll.id}: résultat dupliqué`);
    if (!sourceIds.has(poll.noticeSource))
      errors.push(`${poll.id}: notice inconnue`);
    if (
      poll.fieldworkEnd < poll.fieldworkStart ||
      poll.published < poll.fieldworkEnd
    )
      errors.push(`${poll.id}: calendrier d’enquête incohérent`);
    if (poll.usefulSample !== null && poll.usefulSample > poll.sampleSize)
      errors.push(`${poll.id}: effectif utile supérieur à l’échantillon`);
    if (poll.results.reduce((sum, item) => sum + item.percentage, 0) > 101)
      errors.push(`${poll.id}: résultats incompatibles`);
  }
  const budget = dataset.budget;
  if (budget) {
    if (
      !Number.isInteger(budget.year) ||
      budget.year < 1900 ||
      budget.year >= Number(today.slice(0, 4))
    )
      errors.push('budget: exercice annuel incomplet ou invalide');
    if (
      !dateSchema.safeParse(budget.published).success ||
      budget.published > today
    )
      errors.push('budget: date de publication invalide');
    if (
      !['provisional', 'semi-definitive', 'definitive'].includes(budget.status)
    )
      errors.push('budget: statut de révision invalide');
    if (budget.unit !== '% du PIB' || !sourceIds.has(budget.sourceId))
      errors.push('budget: unité ou source invalide');
    const { spending, revenue, deficit, debt } = budget.values;
    if (![spending, revenue, deficit, debt].every(Number.isFinite))
      errors.push('budget: valeur non numérique');
    if (Math.abs(spending - revenue - deficit) > 0.11)
      errors.push('budget: dépenses, recettes et déficit incompatibles');
  }
  return errors;
}
