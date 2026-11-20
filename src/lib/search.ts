import { getCollection } from 'astro:content';
import { candidates, themes, measures, sources, polls, events } from './data';
import { measureSearchText } from './features.mjs';
export interface SearchEntry {
  id: string;
  type: string;
  title: string;
  text: string;
  url: string;
  candidate: string;
  candidates?: string[];
  theme: string;
  themes?: string[];
  year: string;
  scope: string;
  date: string;
}
export const searchKinds: Record<string, string> = {
  mesure: 'Mesure',
  candidat: 'Candidat',
  theme: 'Thème',
  dossier: 'Dossier',
  source: 'Source',
  sondage: 'Sondage',
  evenement: 'Chronologie',
};
const publicationYear = (s: (typeof sources)[number]) =>
  s.published?.slice(0, 4) ?? s.publishedYear ?? '';
export async function searchEntries(): Promise<SearchEntry[]> {
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  const sourceYear = (ids: string[]) => {
    const years = [
      ...new Set(
        sources
          .filter((source) => ids.includes(source.id))
          .map(publicationYear)
          .filter(Boolean),
      ),
    ];
    return years.length === 1 ? years[0] : '';
  };
  return [
    ...measures.map((measure) => ({
      id: `mesure-${measure.id}`,
      type: 'mesure',
      title: measure.title,
      text: measureSearchText(
        measure,
        candidates.find((c) => c.id === measure.candidate)!.name,
        themes.find((t) => t.id === measure.theme)!.label,
      ),
      url: `/mesures/${measure.id}/`,
      candidate: measure.candidate,
      theme: measure.theme,
      year: sourceYear(measure.sourceRefs.map((ref) => ref.sourceId)),
      scope: measure.scope,
      date: measure.checked,
    })),
    ...candidates.map((candidate) => ({
      id: `candidat-${candidate.id}`,
      type: 'candidat',
      title: candidate.name,
      text: `${candidate.party} ${candidate.status} ${candidate.note}`,
      url: `/candidats/${candidate.id}/`,
      candidate: candidate.id,
      theme: '',
      year: '',
      scope: '',
      date: '',
    })),
    ...themes.map((theme) => ({
      id: `theme-${theme.id}`,
      type: 'theme',
      title: theme.label,
      text: `${theme.short} ${theme.note}`,
      url: `/themes/${theme.id}/`,
      candidate: '',
      theme: theme.id,
      year: '',
      scope: '',
      date: '',
    })),
    ...articles.map((article) => ({
      id: `dossier-${article.id}`,
      type: 'dossier',
      title: article.data.title,
      text: `${article.data.description} ${article.body || ''}`,
      url: `/dossiers/${article.id}/`,
      candidate: '',
      theme: '',
      themes: article.data.themes,
      year: article.data.published.slice(0, 4),
      scope: '',
      date: article.data.published,
    })),
    ...sources.map((source) => {
      const related = measures.filter((measure) =>
        measure.sourceRefs.some((ref) => ref.sourceId === source.id),
      );
      return {
        id: `source-${source.id}`,
        type: 'source',
        title: source.title,
        text: `${source.kind} ${source.url}`,
        url: source.url,
        candidate: '',
        candidates: [
          ...new Set([
            ...related.map((m) => m.candidate),
            ...candidates
              .filter((c) => c.statusSource === source.id)
              .map((c) => c.id),
          ]),
        ],
        theme: '',
        themes: [...new Set(related.map((m) => m.theme))],
        year: publicationYear(source),
        scope: source.kind === 'archive' ? 'archive' : '',
        date: source.published || '',
      };
    }),
    ...polls.map((poll) => ({
      id: `sondage-${poll.id}`,
      type: 'sondage',
      title: `${poll.institute} · ${poll.scenario} · ${poll.published}`,
      text: `${poll.commissioner} ${poll.results.map((result) => result.name).join(' ')} ${poll.method}`,
      url: `/sondages/#enquete=${poll.id}`,
      candidate: '',
      candidates: poll.results.map((result) => result.id),
      theme: '',
      year: poll.published.slice(0, 4),
      scope: '',
      date: poll.published,
    })),
    ...events.map((event) => ({
      id: `evenement-${event.id}`,
      type: 'evenement',
      title: event.title,
      text: `${event.date} ${event.description}`,
      url: `/campagne/#${event.id}`,
      candidate: '',
      candidates: event.candidates,
      theme: '',
      // Only document publication dates belong to the publication-year facet.
      year: event.dateKind === 'publication' ? event.date.slice(0, 4) : '',
      scope: '',
      date: event.date,
    })),
  ];
}
