import { attributionLabel } from './attribution.mjs';
import { candidateById, measures, sourceById, versions } from './data';

const editionById = new Map(versions.map((version) => [version.id, version]));
const debateSources = [
  {
    id: 'lci-restos-2026-11-16',
    title: 'Débat LCI et Les Restos du Cœur',
    date: '2026-11-16',
    sourceIds: ['lci-restos-debat-16-novembre'],
  },
  {
    id: 'lepen-reims-2026-11-25',
    title: 'Marine Le Pen face aux entrepreneurs à Reims',
    date: '2026-11-25',
    sourceIds: ['lepen-reims-lci-salaires-2026', 'lepen-reims-lci-normes-2026'],
  },
  {
    id: 'philippe-bfmtv-2026-08-30',
    title: 'Entretien d’Édouard Philippe sur BFMTV',
    date: '2026-08-30',
    sourceIds: [
      'philippe-bfmtv-ame-30-aout-2026',
      'philippe-bfmtv-referendum-30-aout-2026',
    ],
  },
];
const identified = new Map(
  debateSources.flatMap((event) =>
    event.sourceIds.map((id) => [id, event] as const),
  ),
);

export const debateEvidence = measures
  .flatMap((measure) => {
    if (measure.scope !== 'campagne' && measure.scope !== 'orientation')
      return [];
    const version = editionById.get(`${measure.id}-v${measure.revision}`)!;
    const author = attributionLabel(
      version.snapshot,
      candidateById(measure.candidate).name,
    );
    return version.snapshot.sourceRefs.flatMap((ref, index) => {
      const source = sourceById(ref.sourceId);
      if (!source.originalFormat) return [];
      const event = identified.get(source.id);
      return [
        {
          id: `${version.id}--${source.id}--${index + 1}`,
          title: version.snapshot.title,
          description: version.snapshot.description,
          theme: measure.theme,
          candidate: measure.candidate,
          author,
          nature: measure.scope,
          format: source.originalFormat,
          date: event?.date ?? source.published,
          dateType: event
            ? 'intervention'
            : source.published
              ? 'publication'
              : null,
          event: event
            ? { id: event.id, title: event.title, date: event.date }
            : null,
          version: version.id,
          url: `/mesures/${measure.id}/#version-${version.number}`,
          source: {
            id: source.id,
            title: source.title,
            url: ref.fragment
              ? source.url.split('#')[0] + '#' + ref.fragment
              : source.url,
            passage: ref.locator,
            published: source.published,
            checked: source.checked,
          },
        },
      ];
    });
  })
  .sort(
    (a, b) =>
      (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id),
  );
