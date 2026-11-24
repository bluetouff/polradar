import type { APIRoute, GetStaticPaths } from 'astro';
import { dataset, polls, sourceById, sources } from '../../../lib/data';
import { campaignBriefs } from '../../../lib/briefs';
import {
  digitalLawAsOf,
  digitalLawSections,
} from '../../../lib/digital-law-data';
import { economy, statements } from '../../../lib/economy-data';
import { financing, financingMaps } from '../../../lib/proposal-data';
import { airtime } from '../../../lib/visual-data';
import comparison from '../../../data/retirement-comparison.json';
import { editionId, type Graphic } from '../../../lib/chart-publication';
import { studioFamilies, studioItems } from '../../../lib/studio';
import { salaryGraphic } from '../../../lib/csg-paie.mjs';
import { economyGraphic } from '../../../lib/economy-graphic.mjs';
import {
  pollGraphic,
  pollGraphicSeriesId,
} from '../../../lib/poll-graphic.mjs';
import {
  retirementCard,
  liveGraphicPath,
  frozenGraphicPath,
} from '../../../lib/retirement-embed.mjs';

const origin = 'https://polradar.fr';
const url = (path: string) => new URL(path, origin).href;
const standardGraphic = (id: string, graphic: Graphic, live: string) => ({
  id,
  title: graphic.title,
  description: graphic.alt,
  dateLabel: graphic.dateLabel,
  sources: graphic.sources,
  page: url(graphic.page),
  actualise: url(live),
  fige: url('/graphiques/editions/' + editionId(graphic) + '.svg'),
});
function studioLinks(item: (typeof studioItems)[number]) {
  return {
    famille: studioFamilies[item.family],
    studio: url('/studio/#' + item.id),
    donnees: url('/studio/donnees/' + item.id + '.json'),
  };
}
const collections = {
  sources: () => ({ items: sources }),
  droit: () => ({
    items: [
      ...digitalLawSections.flatMap((section) =>
        section.cases.map((item) => ({
          ...item,
          title: item.question,
          section: section.title,
          checked: digitalLawAsOf,
          page: url(item.href),
        })),
      ),
      {
        id: 'retraite-regime-general',
        title: 'Âge légal et durée d’assurance du régime général',
        checked: comparison.reviewedOn,
        effectiveFrom: comparison.effectiveFrom,
        automaticAgeMonths: comparison.automaticAgeMonths,
        cohorts: comparison.cohorts,
        sources: comparison.legalSources,
        page: url('/comparer/retraites/'),
      },
    ],
  }),
  verifications: () => ({
    items: statements.map((s) => ({ ...s, date: s.statement.date })),
  }),
  breves: async () => ({
    items: (await campaignBriefs()).map((b) => ({
      id: b.article.id,
      title: b.article.data.title,
      description: b.article.data.description,
      date: b.article.data.published,
      evenement: b.event.date,
      category: b.event.category,
      candidats: b.event.candidates,
      sources: b.event.sources.map(sourceById),
      page: url(b.href),
    })),
  }),
  financements: () => ({
    checked: financing.checked,
    items: financingMaps.map((m) => ({
      ...m,
      sources: [m.entry.source, ...(m.entry.additionalSources ?? [])].map(
        sourceById,
      ),
      page: url('/financements/#carte=' + m.id),
    })),
  }),
  arcom: () => ({
    checked: airtime.checked,
    items: airtime.months.flatMap((m) =>
      m.services.map((s) => ({
        id:
          m.month +
          '-' +
          s.kind +
          '-' +
          s.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/gu, '')
            .replace(/[^a-z0-9]+/gu, '-')
            .replace(/-$/u, ''),
        title: s.name,
        date: m.month,
        source: m.sourceUrl,
        sha256: m.sha256,
        unit: 'secondes',
        ...s,
        page: url('/temps-de-parole/'),
      })),
    ),
  }),
  graphiques: () => {
    const published = [
      standardGraphic('csg', salaryGraphic(), '/graphiques/csg.svg'),
      ...economy.map((s) =>
        standardGraphic(
          'economie-' + s.id,
          economyGraphic(economy, s.id),
          '/graphiques/economie/' + s.id + '.svg',
        ),
      ),
      ...polls.map((p) =>
        standardGraphic(
          'sondage-' + p.id,
          pollGraphic(p, sources),
          '/graphiques/sondages/' + pollGraphicSeriesId(p) + '.svg',
        ),
      ),
      ...comparison.cohorts.map((c) => {
        const card = retirementCard(comparison, c, dataset);
        return {
          id: 'retraite-' + c.id,
          title: 'Retraites · génération ' + c.label,
          description: card.summary,
          dateLabel: card.date,
          sources: comparison.legalSources,
          programmes: card.programmes,
          page: url(card.page),
          actualise: url(liveGraphicPath(c.id)),
          fige: url(frozenGraphicPath(card.svg)),
        };
      }),
    ];
    const editions = new Map(studioItems.map((item) => [item.id, item]));
    return {
      items: [
        ...published.map((entry) => {
          // Ces identifiants et éditions restent valides pour les anciens lecteurs.
          const studioId =
            entry.id === 'csg'
              ? 'fiscalite-csg'
              : entry.id
                  .replace(/^sondage-/, 'sondages-')
                  .replace(/^retraite-/, 'retraites-');
          const item = editions.get(studioId);
          if (!item) throw Error('Édition absente du Studio : ' + entry.id);
          return { ...entry, ...studioLinks(item) };
        }),
        ...studioItems
          .filter((item) => item.generated)
          .map((item) => ({
            id: item.id,
            title: item.graphic.title,
            description: item.graphic.alt,
            dateLabel: item.graphic.dateLabel,
            sources: item.graphic.sources,
            page: url(item.graphic.page),
            actualise: url(item.live),
            editionFigee: 'Fichier autonome à télécharger dans le Studio.',
            ...studioLinks(item),
          })),
      ],
    };
  },
};
export const getStaticPaths = (() =>
  Object.keys(collections).map((collection) => ({
    params: { collection },
  }))) satisfies GetStaticPaths;
export const GET: APIRoute = async ({ params }) => {
  const name = params.collection as keyof typeof collections;
  const data = await collections[name]();
  if (new Set(data.items.map((x) => x.id)).size !== data.items.length)
    throw Error('Identifiant documentaire en double : ' + name);
  return Response.json({ version: 1, collection: name, ...data });
};
