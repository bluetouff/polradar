import { attributionLabel } from './attribution.mjs';
import { getCollection } from 'astro:content';
import { candidates, themes, measures, sources, polls, events } from './data';
import { voteCases } from './votes-data';
import { chambers, positionLabel, voteCasePath } from './legislative-votes.mjs';
import { proposalTracks } from './proposal-data';
import { agenda } from './visual-data';
import { economy, statements } from './economy-data';
import { candidateById, formatDate } from './data';
import { campaignBriefs } from './briefs';
import { questions } from './questions';
import { measureSearchText } from './features.mjs';
export interface SearchEntry {
  id: string;
  type: string;
  title: string;
  text: string;
  summary?: string;
  url: string;
  candidate: string;
  candidates?: string[];
  author?: string;
  theme: string;
  themes?: string[];
  year: string;
  scope: string;
  date: string;
}
const readerEntries = [
  [
    'territoire',
    '/territoires/',
    'Les chiffres de ma commune',
    'Données locales par commune et département. Accès aux médecins, logement social et résultats électoraux.',
  ],
  [
    'territoire',
    '/communes/',
    'Résultats par commune',
    'Résultats électoraux du premier et du second tour de la présidentielle de 2022, inscrits, participation et abstention.',
  ],
  [
    'repere',
    '/reperes/',
    'Calendrier électoral',
    'Date des élections, premier tour, second tour, candidats et validation par le Conseil constitutionnel.',
  ],
  [
    'repere',
    '/reperes/#voter',
    'Préparer mon vote',
    'Inscription sur les listes électorales, bureau de vote, vote par procuration et pièces à présenter.',
  ],
  [
    'repere',
    '/reperes/#candidatures',
    'Comment une candidature devient-elle officielle ?',
    'Déclaration, investiture, primaire et liste du Conseil constitutionnel.',
  ],
  [
    'droit',
    '/comparer/retraites/',
    'Retraites et droit en vigueur',
    'Âge légal actuel, âge de départ à la retraite à 64 ans, durée de cotisation, annuités et taux plein.',
  ],
  [
    'droit',
    '/numerique/ce-qui-changerait/',
    'Chiffrement et données personnelles',
    'Droit en vigueur, secret des communications, messageries chiffrées, RGPD et conservation des données.',
  ],
  [
    'droit',
    '/numerique/ce-qui-changerait/cybersecurite/',
    'Cybersécurité et droit en vigueur',
    'Sécurité des systèmes d’information, directive NIS 2, ANSSI et infrastructures critiques.',
  ],
  [
    'droit',
    '/numerique/ce-qui-changerait/souverainete/',
    'Souveraineté numérique et droit en vigueur',
    'Cloud, données et commande publique, hébergement et dépendances numériques.',
  ],
] as const;
const publicationYear = (s: (typeof sources)[number]) =>
  s.published?.slice(0, 4) ?? s.publishedYear ?? '';
let builtIndex: Promise<SearchEntry[]> | undefined;
export function searchEntries(): Promise<SearchEntry[]> {
  if (import.meta.env.DEV) return buildSearchIndex();
  return (builtIndex ??= buildSearchIndex());
}
async function buildSearchIndex(): Promise<SearchEntry[]> {
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
    ...measures.map((measure) => {
      const candidate = candidateById(measure.candidate);
      return {
        id: `mesure-${measure.id}`,
        type: 'mesure',
        title: measure.title,
        summary: measure.description,
        text:
          measureSearchText(
            measure,
            candidate.name,
            themes.find((t) => t.id === measure.theme)!.label,
          ) +
          ' ' +
          candidate.party,
        url: `/mesures/${measure.id}/`,
        candidate: measure.candidate,
        author: attributionLabel(measure, candidate.name),
        theme: measure.theme,
        year: sourceYear(measure.sourceRefs.map((ref) => ref.sourceId)),
        scope: measure.scope,
        date: measure.checked,
      };
    }),
    ...questions.map((q) => ({
      id: 'question-' + q.id,
      type: 'question',
      title: q.title,
      text: q.terms,
      url: q.href,
      candidate: '',
      candidates: q.candidateIds,
      theme: q.theme,
      year: '',
      scope: '',
      date: '',
    })),
    ...voteCases.map((item) => ({
      id: 'vote-' + item.id,
      type: 'vote',
      title: item.title,
      text: [
        item.candidateRecord.name,
        ...item.ballots.map(
          (b) =>
            `${chambers[b.chamber]}, scrutin${b.number === null ? '' : ' n° ' + b.number} du ${formatDate(b.date)}. ${b.shortTitle}. ${positionLabel(b.position, b)}. ${b.title}`,
        ),
        item.note,
      ].join(' '),
      url: voteCasePath(item.id),
      candidate: item.candidate,
      theme: item.measure.theme,
      year: '',
      scope: '',
      date: '',
    })),
    ...proposalTracks.map((track) => ({
      id: 'evolution-' + track.id,
      type: 'evolution',
      title: track.title,
      text: [
        candidateById(track.candidate).name,
        ...track.states.map(
          (state) =>
            `${state.edition} (${state.date.value}). ${state.statement}`,
        ),
        track.note,
      ].join(' '),
      url: '/evolution/#dossier=' + track.id,
      candidate: track.candidate,
      theme: track.theme,
      year: '',
      scope: '',
      date: '',
    })),
    ...agenda.events.map((event) => ({
      id: 'agenda-' + event.id,
      type: 'agenda',
      title: event.title,
      text: [
        candidateById(event.candidate).name,
        agenda.cities.find((city) => city.id === event.city)?.name,
        formatDate(event.date),
        event.latestPossibleDate && formatDate(event.latestPossibleDate),
        event.venue,
        event.note,
      ]
        .filter(Boolean)
        .join(' · '),
      url: '/agenda/#' + event.id,
      candidate: event.candidate,
      theme: '',
      year: sourceYear([event.source, ...(event.additionalSources ?? [])]),
      scope: '',
      date: event.date,
    })),
    ...statements.map((row) => ({
      id: 'verification-' + row.id,
      type: 'verification',
      title: row.title,
      text: [
        row.speaker,
        row.quote,
        row.period,
        row.result.label,
        row.context,
        row.reference.title,
      ].join(' · '),
      url: '/economie/declarations/#' + row.id,
      candidate: row.candidate ?? '',
      theme: row.theme ?? '',
      year: row.statement.date?.slice(0, 4) ?? '',
      scope: '',
      date: row.statement.date ?? '',
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
    ...(await campaignBriefs()).map(({ article, event, href }) => ({
      id: 'breve-' + article.id,
      type: 'breve',
      title: article.data.title,
      summary: article.data.description,
      text: [
        article.data.description,
        event.candidates.map((id) => candidateById(id).name).join(' '),
        article.body,
      ].join(' '),
      url: href,
      candidate: '',
      candidates: event.candidates,
      theme: '',
      year: article.data.published.slice(0, 4),
      scope: '',
      date: article.data.published,
    })),
    ...articles.map((article) => ({
      id: `dossier-${article.id}`,
      type: 'dossier',
      title: article.data.title,
      summary: article.data.description,
      text: `${article.data.description} ${article.id.replaceAll('-', ' ')} ${article.body || ''}`,
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
    ...readerEntries.map(([type, url, title, text]) => ({
      id: 'outil' + url.replace(/[^a-z0-9]+/gi, '-').replace(/-$/, ''),
      type,
      url,
      title,
      text,
      candidate: '',
      theme: '',
      year: '',
      scope: '',
      date: '',
    })),
    ...economy.map((series) => ({
      id: 'indicateur-' + series.id,
      type: 'indicateur',
      title: series.title,
      text: `France · Eurostat · ${series.unit}`,
      url: '/economie/' + series.id + '/',
      candidate: '',
      theme: '',
      year: '',
      scope: '',
      date: '',
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
