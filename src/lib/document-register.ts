import type { Corpus, Measure } from './data';
import { dateSchema, idSchema, publicUrlSchema } from './schema.mjs';
import { z } from 'astro/zod';

const auditedSection = z.strictObject({
  sourceId: idSchema,
  perimeter: z.string().trim().min(1).max(220),
  unit: z.string().trim().min(1).max(30),
  checked: dateSchema,
  units: z
    .array(
      z.strictObject({
        id: idSchema,
        title: z.string().trim().min(1).max(180),
        sourceId: idSchema.optional(),
        review: z
          .enum(['sans-engagement-precis', 'a-examiner', 'a-completer'])
          .optional(),
        measureIds: z.array(idSchema),
      }),
    )
    .min(1),
});

const documentDetails = z.record(
  idSchema,
  z.strictObject({
    type: z.string().trim().min(1).max(80),
    organization: z.string().trim().min(1).max(160),
    reuse: z
      .strictObject({
        label: z.string().trim().min(1).max(320),
        url: publicUrlSchema,
      })
      .optional(),
  }),
);

type Passage = {
  measureId: string;
  candidate: string;
  theme: string;
  scope: Measure['scope'];
  locator: string;
  fragment: string | null;
};

export function buildDocumentRegister(
  corpus: Corpus,
  auditInput: unknown,
  detailsInput: unknown = {},
) {
  const sections = auditedSection.array().parse(auditInput);
  const sourcesById = new Map(corpus.sources.map((s) => [s.id, s]));
  const details = documentDetails.parse(detailsInput);
  for (const id of Object.keys(details))
    if (!sourcesById.has(id))
      throw new Error('Notice descriptive sans document : ' + id);
  const records = new Map(corpus.measures.map((m) => [m.id, m]));
  const authors: Record<
    string,
    { author: string; locator: string; checked: string }
  > = corpus.documentAuthors;
  const audits = new Map<string, (typeof sections)[number]>();
  for (const section of sections) {
    if (!sourcesById.has(section.sourceId) || audits.has(section.sourceId))
      throw new Error(
        'Document absent ou périmètre répété : ' + section.sourceId,
      );
    const units = new Set<string>();
    for (const unit of section.units) {
      const sourceId = unit.sourceId ?? section.sourceId;
      if (
        !sourcesById.has(sourceId) ||
        units.has(unit.id) ||
        new Set(unit.measureIds).size !== unit.measureIds.length
      )
        throw new Error(
          'Étape ou fiche en double : ' + section.sourceId + '/' + unit.id,
        );
      units.add(unit.id);
      if (unit.review === 'a-examiner' && unit.measureIds.length)
        throw new Error('Section à examiner déjà reliée : ' + unit.id);
      if (unit.review === 'a-completer' && !unit.measureIds.length)
        throw new Error(
          'Section partielle sans proposition reliée : ' + unit.id,
        );
      for (const id of unit.measureIds) {
        const measure = records.get(id);
        if (
          !measure?.sourceRefs.some((r) => r.sourceId === sourceId) ||
          (unit.review === 'sans-engagement-precis' &&
            measure.scope !== 'orientation')
        )
          throw new Error('La fiche ne cite pas ce document : ' + id);
      }
    }
    audits.set(section.sourceId, section);
  }

  const links = new Map(
    corpus.sources.map((source) => [
      source.id,
      {
        candidateIds: new Set<string>(),
        themeIds: new Set<string>(),
        passages: [] as Passage[],
      },
    ]),
  );
  for (const m of corpus.measures)
    for (const ref of m.sourceRefs) {
      const link = links.get(ref.sourceId)!;
      link.candidateIds.add(m.candidate);
      link.themeIds.add(m.theme);
      link.passages.push({
        measureId: m.id,
        candidate: m.candidate,
        theme: m.theme,
        scope: m.scope,
        locator: ref.locator,
        fragment: ref.fragment ?? null,
      });
    }
  for (const e of corpus.engagements)
    for (const id of e.sources) {
      links.get(id)!.candidateIds.add(e.candidate);
      links.get(id)!.themeIds.add(e.theme);
    }
  for (const e of corpus.events)
    for (const id of e.sources)
      for (const candidate of e.candidates)
        links.get(id)!.candidateIds.add(candidate);
  for (const c of corpus.candidates)
    for (const id of [c.statusSource, ...(c.programmeReview?.sources ?? [])])
      links.get(id)!.candidateIds.add(c.id);
  const watches = new Map(corpus.watch.map((w) => [w.sourceId, w]));
  return corpus.sources.map((source) => {
    const related = links.get(source.id)!;
    const review = audits.get(source.id);
    const units = review?.units.map(({ sourceId, ...unit }) => ({
      ...unit,
      review: unit.review ?? (unit.measureIds.length ? 'relue' : 'a-examiner'),
      sourceUrl: sourcesById.get(sourceId ?? source.id)!.url,
    }));
    const complete = units?.filter(
      (unit) =>
        unit.review === 'relue' || unit.review === 'sans-engagement-precis',
    ).length;
    const watch = watches.get(source.id);
    const info = details[source.id];
    const processing = units
      ? complete === units.length
        ? 'périmètre relu'
        : 'relecture à compléter'
      : related.passages.length
        ? 'passages localisés'
        : 'référence identifiée';
    return {
      id: source.id,
      title: source.title,
      url: source.url,
      previousUrl: source.previousUrl ?? null,
      kind: source.kind,
      documentType: info?.type ?? source.originalFormat ?? null,
      organization: info?.organization ?? null,
      reuse: info?.reuse ?? null,
      processing,
      format:
        source.originalFormat ??
        (/\.pdf$/i.test(new URL(source.url).pathname) ? 'pdf' : null),
      author: authors[source.id] ?? null,
      publisher: source.publisher ?? null,
      publication: {
        value: source.published ?? source.publishedYear ?? null,
        precision: source.published
          ? 'jour'
          : source.publishedYear
            ? 'année'
            : 'inconnue',
        reference: source.publicationReference ?? null,
      },
      checked: source.checked,
      updated: source.updated ?? null,
      watch: watch
        ? {
            checkedAt: watch.checkedAt,
            status: watch.status,
            fingerprint: watch.fingerprint,
          }
        : null,
      candidates: [...related.candidateIds].sort(),
      themes: [...related.themeIds].sort(),
      measureCount: new Set(related.passages.map((p) => p.measureId)).size,
      passages: related.passages,
      coverage:
        review && units && complete !== undefined
          ? {
              perimeter: review.perimeter,
              unit: review.unit,
              checked: review.checked,
              linked: review.units.filter((u) => u.measureIds.length > 0)
                .length,
              total: review.units.length,
              reviewed: complete,
              remaining: units.length - complete,
              units,
            }
          : null,
    };
  });
}
export type RegisteredDocument = ReturnType<
  typeof buildDocumentRegister
>[number];
