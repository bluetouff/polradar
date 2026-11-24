import { z } from 'astro/zod';
import { isPublicSourceUrl } from './source-url.mjs';

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
  .string()
  .max(1500)
  .regex(/^[^\u0000-\u0020\u007f\\]+$/, 'Caractères interdits dans une URL')
  .pipe(z.url().max(1500))
  .refine(
    isPublicSourceUrl,
    'Une source doit être une URL HTTPS publique, sans identifiants',
  );
const text = z.string().min(1).max(3000);
const partyAuthorSchema = z.string().trim().min(1).max(100);
export const documentAuthorsSchema = z.record(
  idSchema,
  z.strictObject({
    author: partyAuthorSchema,
    locator: z.string().trim().min(1).max(500),
    checked: dateSchema,
  }),
);
export const sourceSchema = z.object({
  id: idSchema,
  title: text,
  url: publicUrlSchema,
  previousUrl: publicUrlSchema.optional(),
  publisher: z.string().trim().min(1).max(160).optional(),
  originalFormat: z.enum(['entretien', 'debat']).optional(),
  watchFormat: z.literal('youtube-oembed').optional(),
  watchContentClass: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_-]{0,59}$/)
    .optional(),
  kind: z.enum(['campagne', 'parti', 'institution', 'presse', 'archive']),
  published: dateSchema.nullable(),
  publicationReference: publicUrlSchema.optional(),
  publishedYear: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  updated: dateSchema.nullable().optional(),
  watch: z.boolean().optional(),
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
  withdrawnOn: dateSchema.optional(),
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
  partyAuthor: partyAuthorSchema.optional(),
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
  category: z.enum([
    'candidature',
    'programme',
    'sondage',
    'meeting',
    'calendrier',
  ]),
  dateKind: z.enum(['evenement', 'publication', 'mise-a-jour']),
  publicationBrief: dateSchema.optional(),
  candidates: z.array(idSchema).max(40),
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
  registeredSample: z.number().int().positive(),
  round: z.enum(['premier', 'second']),
  questionKey: idSchema,
  surveyId: idSchema.optional(),
  question: z
    .discriminatedUnion('status', [
      z.strictObject({ status: z.literal('a-relire') }),
      z.strictObject({
        status: z.literal('verifiee'),
        wording: text,
        base: text,
        sourceId: idSchema,
        page: z.number().int().positive(),
        checked: dateSchema,
        equivalence: z.strictObject({ key: idSchema, reason: text }).optional(),
      }),
    ])
    .optional(),
  population: text,
  method: text,
  noticePage: z.number().int().positive(),
  noIntention: z.number().min(0).max(100).nullable(),
  noIntentionNote: text.optional(),
  margin: z.object({
    min: z.number().nonnegative().max(100),
    max: z.number().nonnegative().max(100),
    confidence: z.number().positive().max(100),
  }),
  scenario: text,
  noticeSource: idSchema,
  resultSource: idSchema.optional(),
  resultPage: z.number().int().positive().optional(),
  rounding: z.literal('unite').optional(),
  results: z
    .array(
      z
        .object({
          id: idSchema,
          name: text,
          percentage: z.number().min(0).max(100).nullable(),
          below: z.number().positive().max(100).optional(),
        })
        .refine(
          (result) => result.below === undefined || result.percentage === null,
          'Une borne exclut un score précis',
        ),
    )
    .min(2)
    .max(40),
  uncertainty: text,
});

export const sourceRefSchema = z.object({
  sourceId: idSchema,
  locator: z.string().min(1).max(1000),
  fragment: z
    .string()
    .regex(/^(?:page=|proposition-)[1-9]\d{0,3}$/)
    .optional(),
});
export const metricSchema = z.object({
  key: idSchema,
  label: text,
  value: z.number(),
  unit: text,
  sourceId: idSchema,
});
export const amountSchema = z.object({
  label: text,
  value: z.number(),
  unit: text,
  period: z.enum(['mois', 'an', 'mandat', 'ponctuel']),
  basis: z.enum(['brut', 'net', 'non-applicable']),
  sourceId: idSchema,
});
export const measureSnapshotSchema = z.object({
  title: text,
  description: text,
  beneficiaries: z.string().max(2000).nullable(),
  timing: z.string().max(2000).nullable(),
  financing: z.string().max(2000).nullable(),
  metrics: z.array(metricSchema),
  amounts: z.array(amountSchema),
  sourceRefs: z.array(sourceRefSchema).min(1),
  scope: z.enum(['campagne', 'parti', 'orientation', 'archive']),
  partyAuthor: partyAuthorSchema.optional(),
  edition: text,
  checked: dateSchema,
});
export const measureSchema = measureSnapshotSchema.extend({
  id: idSchema,
  parentId: idSchema,
  candidate: idSchema,
  theme: idSchema,
  revision: z.number().int().positive(),
});
export const versionSchema = z.object({
  id: idSchema,
  measureId: idSchema,
  number: z.number().int().positive(),
  kind: z.enum(['import', 'enrichissement', 'correction', 'programme']),
  observedOn: dateSchema,
  recordedAt: z.iso.datetime({ offset: true }).nullable(),
  summary: text,
  snapshot: measureSnapshotSchema,
});
export const watchSchema = z.object({
  sourceId: idSchema,
  checkedAt: z.iso.datetime({ offset: true }),
  status: z.enum(['accessible', 'modifie', 'indisponible', 'bloque']),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  fingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  previousFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  bytes: z.number().int().nonnegative(),
  contentType: z.string().max(200),
  message: z.string().max(500),
  reviewedAt: z.iso.datetime({ offset: true }).optional(),
  reviewNote: z.string().min(1).max(500).optional(),
});

/** Civil dates in the editorial timezone; ISO timestamps stay in their original offset. */
export function civilDateInParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** @param {Record<string, any>} dataset */
export function validateFeatures(dataset) {
  const errors = [];
  const schemas = {
    measures: measureSchema,
    versions: versionSchema,
    watch: watchSchema,
  };
  for (const [name, schema] of Object.entries(schemas)) {
    if (!Array.isArray(dataset[name])) {
      errors.push(`${name}: tableau manquant`);
      continue;
    }
    const seen = new Set();
    for (const row of dataset[name]) {
      const parsed = schema.safeParse(row);
      if (!parsed.success)
        errors.push(
          `${name}/${row?.id || row?.sourceId}: ${parsed.error.message}`,
        );
      const id = row?.id || row?.sourceId;
      if (seen.has(id)) errors.push(`${name}: identifiant dupliqué ${id}`);
      seen.add(id);
    }
  }
  if (errors.length) return errors;
  const sources = new Map(dataset.sources.map((s) => [s.id, s])),
    parents = new Map(dataset.engagements.map((e) => [e.id, e]));
  const measures = new Map(dataset.measures.map((m) => [m.id, m]));
  const today = civilDateInParis();
  for (const measure of dataset.measures) {
    const parent = parents.get(measure.parentId);
    if (
      !parent ||
      parent.candidate !== measure.candidate ||
      parent.theme !== measure.theme
    )
      errors.push(`${measure.id}: dossier parent incohérent`);
    if (measure.checked > today)
      errors.push(`${measure.id}: consultation future`);
    for (const ref of [
      ...measure.sourceRefs,
      ...measure.metrics,
      ...measure.amounts,
    ])
      if (!sources.has(ref.sourceId))
        errors.push(`${measure.id}: source inconnue`);
    if (measure.scope === 'archive' && !measure.edition.includes('2022'))
      errors.push(`${measure.id}: archive sans millésime`);
    if (measure.partyAuthor !== parent?.partyAuthor)
      errors.push(`${measure.id}: auteur collectif incohérent avec le dossier`);
    const versions = dataset.versions
      .filter((v) => v.measureId === measure.id)
      .sort((a, b) => a.number - b.number);
    if (
      versions.length !== measure.revision ||
      versions.some((v, i) => v.number !== i + 1)
    )
      errors.push(`${measure.id}: séquence de versions invalide`);
    if (
      versions.some(
        (version, index) =>
          index > 0 && version.observedOn < versions[index - 1].observedOn,
      )
    )
      errors.push(`${measure.id}: versions non chronologiques`);
    const dated = versions.filter((version) => version.recordedAt !== null);
    if (
      dated.some(
        (version, index) =>
          index > 0 &&
          Date.parse(version.recordedAt) <
            Date.parse(dated[index - 1].recordedAt),
      )
    )
      errors.push(`${measure.id}: enregistrements non chronologiques`);
    const current = versions.at(-1)?.snapshot;
    if (current) {
      if (current.partyAuthor !== measure.partyAuthor)
        errors.push(
          `${measure.id}: auteur collectif absent de la version courante`,
        );
      for (const key of Object.keys(current))
        if (JSON.stringify(current[key]) !== JSON.stringify(measure[key]))
          errors.push(`${measure.id}: version courante incohérente (${key})`);
    }
  }
  for (const version of dataset.versions) {
    if (!measures.has(version.measureId))
      errors.push(`${version.id}: mesure inconnue`);
    if (version.observedOn > today || version.snapshot.checked > today)
      errors.push(`${version.id}: version future`);
    if (version.snapshot.checked > version.observedOn)
      errors.push(`${version.id}: consultation après observation`);
    if (
      version.recordedAt !== null &&
      (Date.parse(version.recordedAt) > Date.now() + 60000 ||
        civilDateInParis(new Date(version.recordedAt)) < version.observedOn)
    )
      errors.push(`${version.id}: horodatage incohérent`);
    if ((version.number === 1) !== (version.kind === 'import'))
      errors.push(`${version.id}: première version non identifiée`);
    if (
      version.snapshot.partyAuthor &&
      (!['parti', 'archive'].includes(version.snapshot.scope) ||
        !version.snapshot.sourceRefs.some(
          ({ sourceId }) => sources.get(sourceId)?.kind === 'parti',
        ))
    )
      errors.push(`${version.id}: auteur collectif sans document de parti`);
    for (const ref of [
      ...version.snapshot.sourceRefs,
      ...version.snapshot.metrics,
      ...version.snapshot.amounts,
    ])
      if (!sources.has(ref.sourceId))
        errors.push(`${version.id}: source inconnue`);
  }
  for (const row of dataset.watch) {
    if (!sources.has(row.sourceId))
      errors.push(`${row.sourceId}: source de veille inconnue`);
    if (Date.parse(row.checkedAt) > Date.now() + 60000)
      errors.push(`${row.sourceId}: veille future`);
    if (row.reviewedAt && Date.parse(row.reviewedAt) > Date.now() + 60000)
      errors.push(`${row.sourceId}: relecture future`);
  }
  return errors;
}

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
  const today = civilDateInParis();
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
    if (source.watchFormat === 'youtube-oembed') {
      const video = new URL(source.url);
      if (
        video.hostname !== 'www.youtube.com' ||
        video.pathname !== '/watch' ||
        video.hash ||
        [...video.searchParams.keys()].join(',') !== 'v' ||
        !/^[A-Za-z0-9_-]{11}$/.test(video.searchParams.get('v') || '') ||
        source.watchContentClass
      )
        errors.push(`${source.id}: référence vidéo non canonique`);
    }
    if (source.checked > today)
      errors.push(`${source.id}: consultation future`);
    if (
      source.publishedYear &&
      (source.publishedYear > source.checked.slice(0, 4) ||
        (source.published &&
          source.published.slice(0, 4) !== source.publishedYear))
    )
      errors.push(`${source.id}: année de publication incohérente`);
    if (source.published && source.published > source.checked)
      errors.push(`${source.id}: publication après consultation`);
    if (
      source.updated &&
      (source.updated > source.checked ||
        (source.published && source.updated < source.published))
    )
      errors.push(`${source.id}: date de mise à jour incohérente`);
  }
  for (const candidate of dataset.candidates) {
    if (candidate.withdrawnOn && candidate.withdrawnOn > today)
      errors.push(`${candidate.id}: retrait futur`);
    if (!sourceIds.has(candidate.statusSource))
      errors.push(`${candidate.id}: statut sans source existante`);
  }
  for (const item of dataset.engagements) {
    if (item.checked > today) errors.push(`${item.id}: consultation future`);
    if (!candidateIds.has(item.candidate))
      errors.push(`${item.id}: candidature inconnue`);
    if (!themeIds.has(item.theme)) errors.push(`${item.id}: thème inconnu`);
    const pair = JSON.stringify([
      item.candidate,
      item.theme,
      item.partyAuthor,
      item.scope === 'parti',
      item.scope === 'archive',
    ]);
    if (pairs.has(pair)) errors.push(`${item.id}: doublon candidat/thème`);
    pairs.add(pair);
    for (const id of item.sources)
      if (!sourceIds.has(id)) errors.push(`${item.id}: source inconnue ${id}`);
    if (
      item.partyAuthor &&
      (!['parti', 'archive'].includes(item.scope) ||
        !dataset.sources.some(
          (source) =>
            source.kind === 'parti' && item.sources.includes(source.id),
        ))
    )
      errors.push(`${item.id}: auteur collectif sans document de parti`);
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
  for (const event of dataset.events) {
    if (
      event.publicationBrief &&
      (event.dateKind !== 'publication' ||
        event.date > event.publicationBrief ||
        event.publicationBrief > today)
    )
      errors.push(
        `${event.id}: date de brève incompatible avec la publication d’origine`,
      );
    if (event.kind === 'past' && event.date > today)
      errors.push(`${event.id}: événement passé daté dans le futur`);
    for (const id of event.candidates)
      if (!candidateIds.has(id))
        errors.push(`${event.id}: candidat inconnu ${id}`);
    for (const id of event.sources) {
      if (!sourceIds.has(id)) errors.push(`${event.id}: source inconnue ${id}`);
    }
  }
  const surveyDesign = new Map();
  for (const poll of dataset.polls) {
    if (poll.surveyId) {
      const design = JSON.stringify([
        poll.institute,
        poll.fieldworkStart,
        poll.fieldworkEnd,
      ]);
      if (
        surveyDesign.has(poll.surveyId) &&
        surveyDesign.get(poll.surveyId) !== design
      )
        errors.push(`${poll.id}: terrains contradictoires pour cette enquête`);
      surveyDesign.set(poll.surveyId, design);
    }
    if (
      poll.question?.status === 'verifiee' &&
      (!sourceIds.has(poll.question.sourceId) ||
        ![poll.noticeSource, poll.resultSource].includes(
          poll.question.sourceId,
        ) ||
        poll.question.checked > today ||
        poll.question.checked < poll.fieldworkEnd)
    )
      errors.push(`${poll.id}: référence ou date de la question invalide`);
    if (poll.registeredSample > poll.sampleSize)
      errors.push(`${poll.id}: inscrits supérieurs à l’échantillon`);
    if (poll.usefulSample !== null && poll.usefulSample > poll.registeredSample)
      errors.push(`${poll.id}: effectif utile supérieur aux inscrits`);
    if (poll.margin.min > poll.margin.max)
      errors.push(`${poll.id}: plage d’incertitude invalide`);
    if (poll.published > today) errors.push(`${poll.id}: publication future`);
    if (
      new Set(poll.results.map((item) => item.name)).size !==
        poll.results.length ||
      new Set(poll.results.map((item) => item.id)).size !== poll.results.length
    )
      errors.push(`${poll.id}: résultat dupliqué`);
    if (!sourceIds.has(poll.noticeSource))
      errors.push(`${poll.id}: notice inconnue`);
    if (poll.resultSource && !sourceIds.has(poll.resultSource))
      errors.push(`${poll.id}: source de résultats inconnue`);
    if (Boolean(poll.resultSource) !== Boolean(poll.resultPage))
      errors.push(`${poll.id}: référence de résultats incomplète`);
    if (
      poll.fieldworkEnd < poll.fieldworkStart ||
      poll.published < poll.fieldworkEnd
    )
      errors.push(`${poll.id}: calendrier d’enquête incohérent`);
    if (poll.usefulSample !== null && poll.usefulSample > poll.sampleSize)
      errors.push(`${poll.id}: effectif utile supérieur à l’échantillon`);
    const scores = poll.results
      .map((item) => item.percentage)
      .filter((score) => score !== null);
    const tolerance =
      poll.rounding === 'unite' ? Math.min(2, scores.length / 2) : 1;
    if (
      scores.length < 2 ||
      (poll.rounding === 'unite' &&
        scores.some((score) => !Number.isInteger(score))) ||
      Math.abs(scores.reduce((sum, score) => sum + score, 0) - 100) > tolerance
    )
      errors.push(`${poll.id}: résultats incompatibles`);
    if (poll.round === 'second' && poll.results.length !== 2)
      errors.push(`${poll.id}: second tour sans duel`);
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
