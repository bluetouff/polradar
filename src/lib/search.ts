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
import { measureSearchText, pollReferenceDate } from './features.mjs';
import { householdSimulators } from './household-simulators.mjs';
import { digitalTopicByMeasure } from './digital-data';
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
  ...householdSimulators.map((entry) => [
    'simulateur',
    '/economie/simulateurs/' + entry.id + '/',
    entry.title,
    entry.summary,
  ]),
  [
    'repere',
    '/numerique/candidats/',
    'Le numérique par candidat',
    'Fiches numériques et documents examinés pour chaque candidature.',
  ],
  [
    'repere',
    '/numerique/liberte-expression/',
    'Liberté d’expression',
    'Propositions sur le DSA, la modération des plateformes, la liberté de la presse, le pluralisme et l’Arcom.',
  ],
  [
    'simulateur',
    '/economie/simulateurs/',
    'Simuler la CSG sur un salaire',
    'Calcul de la contribution sociale généralisée à partir du salaire brut, avec les taux, l’assiette et la part déductible selon le barème en vigueur.',
  ],
  [
    'simulateur',
    '/economie/simulateurs/electricite/',
    'Simuler les taxes sur l’électricité',
    'Facture, consommation en kWh, TVA et accise selon les propositions.',
  ],
  [
    'simulateur',
    '/economie/simulateur-budgetaire/',
    'Simulateur des finances publiques',
    'Calculer l’effet de variations des recettes et dépenses sur le solde public. Comptes de l’Insee et montants des programmes.',
  ],
  [
    'repere',
    '/debats/',
    'Débats et entretiens',
    'Observatoire des déclarations publiques, débats de campagne, auteurs et passages dans les sources originales.',
  ],
  [
    'repere',
    '/reperes/#parrainages',
    'Parrainages officiels',
    'Soutiens d’élus, promesses de parrainage et présentations publiées par le Conseil constitutionnel.',
  ],
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
    'Âge légal de départ selon la génération, seuil de 64 ans pour les générations concernées, durée de cotisation, annuités, ouverture des droits et annulation de la décote à l’âge du taux plein.',
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
  const withProgramme = new Set(
    measures
      .filter(({ scope }) => scope === 'campagne')
      .map(({ candidate }) => candidate),
  );
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
          candidate.party +
          (digitalTopicByMeasure.has(measure.id) ? ' numérique' : ''),
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
      text: `${candidate.party} ${candidate.status} ${candidate.note}${candidate.programmeReview || withProgramme.has(candidate.id) ? ' Programme et propositions documentées.' : ''}`,
      url: `/candidats/${candidate.id}/`,
      candidate: candidate.id,
      theme: '',
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
      title: `${poll.institute} · ${poll.scenario} · ${pollReferenceDate(poll)}`,
      text: `${poll.commissioner} ${poll.results.map((result) => result.name).join(' ')} ${poll.method}`,
      url: `/sondages/#enquete=${poll.id}`,
      candidate: '',
      candidates: poll.results.map((result) => result.id),
      theme: '',
      year: pollReferenceDate(poll).slice(0, 4),
      scope: '',
      date: pollReferenceDate(poll),
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
      text: `France · Eurostat · ${series.unit} · ${series.description}`,
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
