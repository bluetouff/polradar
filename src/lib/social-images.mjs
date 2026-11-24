import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { francePath, projectFrance } from './campaign-visuals-view.mjs';
import { divergenceGroups } from './divergences.mjs';
const read = (name) =>
  JSON.parse(readFileSync(resolve('src/data', `${name}.json`), 'utf8'));
// Astro executes a bundled copy in dist/.prerender. Build inputs stay in the
// project root, where the documented npm commands and CI run.
if (
  JSON.parse(readFileSync(resolve('package.json'), 'utf8')).name !== 'polradar'
)
  throw Error('Exécuter la génération OG depuis la racine de Polradar');
const measures = read('measures'),
  candidates = read('candidates').filter((person) => !person.withdrawnOn),
  themes = read('themes');
const current = measures.filter((m) => m.scope !== 'archive');
const sources = read('sources'),
  versions = read('versions'),
  evolution = read('proposal-evolution');
const finance = read('financing-maps'),
  budgets = read('programme-budgets'),
  agenda = read('campaign-agenda');
const votes = read('legislative-votes'),
  polls = read('polls'),
  markets = read('prediction-markets');
const watch = read('watch'),
  events = read('events'),
  airtime = read('airtime');
const ches = read('ches-france-2024');
const curatedComparisons = read('divergence-positions');
const quantitativeComparisons = divergenceGroups(
  measures.filter((m) => candidates.some((c) => c.id === m.candidate)),
  candidates,
  themes,
);
const number = (n) => n.toLocaleString('fr-FR');
const counts = (rows, key) =>
  [...new Set(rows.map((r) => r[key]))].map((label) => ({
    label,
    value: rows.filter((r) => r[key] === label).length,
  }));
const themeBars = themes
  .map((t) => ({
    label: t.label,
    value: current.filter((m) => m.theme === t.id).length,
  }))
  .sort((a, b) => b.value - a.value);
const instituts = counts(polls, 'institute').sort((a, b) => b.value - a.value);
const programme = budgets.profiles
  .find((p) => p.candidate === 'lisnard')
  .entries.find((e) => e.id === 'lisnard-economies');
const smic = evolution.tracks
  .find((t) => t.id === 'melenchon-smic')
  .stateIds.map((id) => evolution.states.find((s) => s.id === id));
const communeIds = new Set(agenda.events.map((e) => e.city).filter(Boolean));
const chartMap = {
  path: francePath(read('france-map').rings),
  points: agenda.cities
    .filter((c) => communeIds.has(c.id))
    .map((c) => ({ ...projectFrance(c.coordinates), name: c.name })),
};
const functions = [
  ['mesures', 'Mesures', current.length],
  ['candidats', 'Candidats', candidates.length],
  ['evolution', 'États datés', evolution.states.length],
  ['financements', 'Cartes financières', finance.maps.length],
];
const bars = (rows, unit = 'fiches dans le corpus') => ({
  kind: 'bars',
  rows,
  unit,
});
const tiles = (rows, label) => ({
  kind: 'tiles',
  rows: rows.map(([label, value]) => ({ label, value: number(value) })),
  label,
});
const communes2022 = read('communes-2022');
const retirement = read('retirement-comparison');
const digitalTopics = read('digital-topics');
const digitalComparison = read('digital-comparison');
const digitalLaw = read('digital-law');
const economy = read('economy-series');
const statements = read('economic-statements');
const generation1969 = retirement.cohorts.find(
  (row) => row.id === '1969-et-apres',
);
/** @type {Array<[string, string, string, string, string, string, Record<string, any>]>} */
const defs = [
  [
    'echiquier',
    '/echiquier/',
    'France · Chapel Hill Expert Survey',
    'Échiquier\npolitique',
    'Les partis en 2024 et les positions publiées pour 2027.',
    'navy',
    {
      kind: 'party-plane',
      parties: ches.parties.map((p) => ({
        name: p.label,
        x: p.lrecon,
        y: p.galtan,
      })),
    },
  ],
  [
    'retraites-droit',
    '/comparer/retraites/',
    'Ce qui changerait',
    'Retraites et\ndroit en vigueur',
    'Trois programmes comparés au régime général.',
    'navy',
    tiles(
      [
        ['Âge légal · ans', generation1969.ageMonths / 12],
        ['Durée · trimestres', generation1969.quarters],
        ['Taux plein · ans', retirement.automaticAgeMonths / 12],
        ['Programmes', retirement.programmes.length],
      ],
      'Règles actuelles · génération 1969 et après',
    ),
  ],
  [
    'communes',
    '/communes/',
    'Présidentielle 2022',
    'Les résultats\npar commune',
    `${number(communes2022.count)} communes. Les résultats définitifs des deux tours.`,
    'sage',
    tiles(
      [
        ['Communes', communes2022.count],
        ['Tours', communes2022.rounds.length],
        ['Indicateurs Insee', communes2022.withContext],
        ['Recensement', 2023],
      ],
      'Ministère de l’Intérieur · Insee',
    ),
  ],
  [
    'numerique',
    '/numerique/',
    'Les programmes',
    'Propositions sur\nle numérique',
    'Services publics, données, formation et centres de calcul.',
    'sage',
    bars(
      digitalTopics.map((topic) => ({
        label: topic.label,
        value: topic.measures.length,
      })),
      'Fiches recensées par sujet',
    ),
  ],
  [
    'numerique-droit',
    '/numerique/ce-qui-changerait/',
    'Ce qui changerait',
    'Le numérique et\nle droit en vigueur',
    'Chiffrement, vie privée et données publiques.',
    'navy',
    tiles(
      [
        ['Thèmes', digitalLaw.sections.length],
        ['Situations', digitalLaw.sections.flatMap((s) => s.cases).length],
        [
          'Textes de référence',
          new Set(
            digitalLaw.sections.flatMap((s) =>
              s.cases.flatMap((c) =>
                c.rules.flatMap((r) => r.refs.map((ref) => ref.sourceId)),
              ),
            ),
          ).size,
        ],
        [
          'Propositions',
          new Set(
            digitalLaw.sections.flatMap((s) =>
              s.cases.flatMap((c) =>
                c.changes.map((change) => change.versionId),
              ),
            ),
          ).size,
        ],
      ],
      'Comparatif juridique',
    ),
  ],
  [
    'comparatif-numerique',
    '/numerique/comparer/',
    'Les programmes',
    'Comparer le\nnumérique',
    'Cybersécurité, chiffrement et souveraineté.',
    'navy',
    bars(
      digitalComparison.axes.map((axis) => ({
        label: axis.title,
        value: new Set(
          axis.rows.flatMap((row) =>
            row.entries.map(({ versionId }) => versionId),
          ),
        ).size,
      })),
      'Fiches comparées par axe',
    ),
  ],
  [
    'economie',
    '/economie/',
    'Statistiques publiques',
    'Indicateurs\néconomiques',
    'France · Prix, emploi, activité et finances publiques.',
    'navy',
    bars(
      [
        ['Prix', 'prix'],
        ['Emploi', 'emploi'],
        ['Activité', 'activite'],
        ['Revenus', 'niveau-de-vie'],
        ['Finances publiques', 'finances'],
      ].map(([label, group]) => ({
        label,
        value: economy.filter((row) => row.group === group).length,
      })),
      'Séries Eurostat',
    ),
  ],
  [
    'declarations',
    '/economie/declarations/',
    'Statistiques publiques',
    'Déclarations et\nchiffres publics',
    'Les chiffres cités face aux publications officielles.',
    'sage',
    tiles([['Déclarations vérifiées', statements.length]], 'Insee · RTE'),
  ],
  [
    'accueil',
    '/',
    'Présidentielle française',
    'Présidentielle\n2027',
    'Programmes, sondages et votes au Parlement.',
    'navy',
    {
      kind: 'home',
      rows: themeBars.slice(0, 5),
      total: current.length,
      candidates: candidates.length,
      themes: themes.length,
    },
  ],
  [
    'candidats',
    '/candidats/',
    'Les candidatures',
    'Candidats',
    'Candidats, programmes et sources.',
    'sage',
    {
      kind: 'people',
      names: candidates.slice(0, 9).map((c) => c.name),
      total: candidates.length,
    },
  ],
  [
    'mesures',
    '/mesures/',
    'Les programmes',
    'Mesures et\norientations',
    `${number(current.length)} fiches hors archives.`,
    'ivory',
    bars(themeBars.slice(0, 6)),
  ],
  [
    'engagements',
    '/engagements/',
    'Le corpus thématique',
    'Engagements',
    'Les propositions regroupées par thème.',
    'clay',
    bars(themeBars.slice(3, 9)),
  ],
  [
    'themes',
    '/themes/',
    'Les programmes',
    'Programmes\npar thème',
    `${themes.length} thèmes pour explorer les propositions.`,
    'sage',
    bars(themeBars.slice(0, 6)),
  ],
  [
    'comparer',
    '/comparer/',
    'Comparer les programmes',
    'Comparer les\npropositions',
    'Candidats, thèmes, mesures et sources.',
    'ivory',
    tiles(
      [
        ['Thèmes', themes.length],
        ['Candidats', candidates.length],
        ['Fiches actuelles', current.length],
        ['Archives 2022', measures.length - current.length],
      ],
      'Périmètre du corpus',
    ),
  ],
  [
    'questions',
    '/questions/',
    'Comparer les programmes',
    'Qui propose\nquoi ?',
    'Les réponses des candidats, leurs documents et les sujets encore à renseigner.',
    'sage',
    {
      kind: 'document',
      rows: [
        'Question précise',
        'Texte de campagne ou de parti',
        'Date du document',
        'Couverture des candidatures',
      ],
    },
  ],
  [
    'argent-des-campagnes',
    '/argent-des-campagnes/',
    'Publications officielles',
    'L’argent des\ncampagnes',
    'Comptes électoraux, décisions de la CNCCFP et déclarations auprès de la HATVP.',
    'ivory',
    {
      kind: 'document',
      rows: [
        'Financement électoral',
        'Dépôt des comptes',
        'Décisions de la Commission',
        'Déclarations des candidats',
      ],
    },
  ],
  [
    'divergences',
    '/divergences/',
    'Comparaisons des programmes',
    'Carte des\ndivergences',
    'Comparez les mesures, les montants et leurs conditions.',
    'clay',
    tiles(
      [
        [
          'Sujets documentés',
          curatedComparisons.length + quantitativeComparisons.length,
        ],
        ['Comparaisons par mesure', curatedComparisons.length],
        ['Axes chiffrés', quantitativeComparisons.length],
        [
          'Thèmes',
          new Set(
            [...curatedComparisons, ...quantitativeComparisons].map(
              (row) => row.theme,
            ),
          ).size,
        ],
      ],
      'Comparaisons du corpus',
    ),
  ],
  [
    'evolution',
    '/evolution/',
    'Documents datés',
    'Évolution des\npropositions',
    `${evolution.tracks.length} dossiers · ${evolution.states.length} états documentés.`,
    'navy',
    {
      kind: 'timeline',
      label: 'SMIC mensuel net · programmes soutenus par J.-L. Mélenchon',
      rows: smic.map((s) => ({
        value: number(s.value) + ' €',
        label: s.date.kind === 'consultation' ? 'Campagne 2027' : s.date.value,
        detail:
          s.date.value === '2024'
            ? 'Programme collectif NFP'
            : 'Programme présidentiel',
      })),
    },
  ],
  [
    'votes',
    '/votes/',
    'Programmes et Parlement',
    'Propositions et\nvotes passés',
    `${votes.cases.length} dossiers · listes nominatives officielles.`,
    'navy',
    { kind: 'vote', ballot: votes.ballots.find((b) => b.id === 'an15-169') },
  ],
  [
    'financements',
    '/financements/',
    'Financements annoncés',
    'Carte des\nfinancements',
    `${finance.maps.length} cartes · montants et affectations sourcés.`,
    'sage',
    { kind: 'finance', total: programme.euros, rows: programme.allocation },
  ],
  [
    'breves',
    '/breves/',
    'Rédaction Polradar',
    'Brèves de\ncampagne',
    'Les annonces, les programmes et les décisions de campagne.',
    'navy',
    {
      kind: 'document',
      rows: ['Candidatures', 'Programmes', 'Décisions des partis'],
    },
  ],
  [
    'campagne',
    '/campagne/',
    'La campagne présidentielle',
    'Chronologie\nde la campagne',
    `${events.length} événements datés dans le corpus.`,
    'ivory',
    {
      kind: 'timeline',
      label: 'Événements et publications documentés',
      rows: [...events]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-3)
        .map((e) => ({
          value: e.date.split('-').reverse().join('.'),
          label: e.title,
          detail:
            {
              evenement: 'Événement',
              publication: 'Publication',
              mise_a_jour: 'Mise à jour',
            }[e.dateKind] || 'Date documentée',
        })),
    },
  ],
  [
    'sondages',
    '/sondages/',
    'Intentions de vote',
    'Sondages',
    'Scénarios, terrains et notices officielles.',
    'sage',
    bars(instituts, 'scénarios documentés par institut'),
  ],
  [
    'marches-predictifs',
    '/marches-predictifs/',
    'Relevés des plateformes',
    'Marchés\nprédictifs',
    'Polymarket et Kalshi, relevés séparés.',
    'navy',
    bars(
      markets.providers.map((p) => ({
        label: p.id === 'kalshi' ? 'Kalshi' : 'Polymarket',
        value: p.contracts.length,
      })),
      'contrats recensés · pas des intentions de vote',
    ),
  ],
  [
    'temps-de-parole',
    '/temps-de-parole/',
    'Relevés Arcom',
    'Temps de\nparole',
    'Télévision et radio · juillet à septembre 2026.',
    'ivory',
    tiles(
      [
        ['Mois', airtime.months.length],
        [
          'Médias',
          new Set(airtime.months.flatMap((m) => m.services.map((s) => s.name)))
            .size,
        ],
      ],
      'Données publiées par l’Arcom',
    ),
  ],
  [
    'budget-programmes',
    '/budget-programmes/',
    'Chiffrages des programmes',
    'Budgets\nannoncés',
    'Périodes, hypothèses et sources.',
    'clay',
    bars(
      counts(
        budgets.profiles.flatMap((p) => p.entries),
        'period',
      ).map((r) => ({
        ...r,
        label:
          {
            annuel: 'Annuels',
            pluriannuel: 'Pluriannuels',
            'non-precise': 'Période non précisée',
            ponctuel: 'Ponctuels',
            horizon: 'Objectifs à terme',
          }[r.label] || r.label,
      })),
      'montants recensés · sans addition des périodes',
    ),
  ],
  [
    'agenda',
    '/agenda/',
    'Rendez-vous de campagne',
    'Agenda\nde campagne',
    `${agenda.events.length} rendez-vous · ${communeIds.size} communes.`,
    'sage',
    { kind: 'map', ...chartMap },
  ],
  [
    'mises-a-jour',
    '/mises-a-jour/',
    'Données publiques',
    'Mises à jour\nautomatiques',
    'Contrôles quotidiens, changements et incidents.',
    'navy',
    {
      kind: 'document',
      rows: [
        'Contrôles de collecte',
        'Modifications publiées',
        'Documents à relire',
        'Sources indisponibles',
      ],
    },
  ],
  [
    'veille',
    '/veille/',
    'Sources et documents',
    'Veille des\nprogrammes',
    'Une collecte quotidienne, relue avant publication.',
    'navy',
    bars(
      [
        {
          label: 'Accessibles',
          value: watch.filter((r) => r.status === 'accessible').length,
        },
        {
          label: 'À examiner',
          value: watch.filter((r) => r.status === 'modifie').length,
        },
        {
          label: 'Accès en échec',
          value: watch.filter((r) =>
            ['bloque', 'indisponible'].includes(r.status),
          ).length,
        },
      ],
      watch.length + ' sources contrôlées',
    ),
  ],
  [
    'historique',
    '/historique/',
    'Révisions éditoriales',
    'Historique\ndes fiches',
    'Les versions du contenu Polradar.',
    'ivory',
    bars(
      counts(versions, 'kind').map((r) => ({
        ...r,
        label:
          {
            import: 'Premières fiches',
            enrichissement: 'Enrichissements',
            correction: 'Corrections',
            evolution: 'Évolutions signalées',
          }[r.label] || r.label,
      })),
      'versions éditoriales · pas des changements de programme',
    ),
  ],
  [
    'suivi',
    '/suivi/',
    'Votre sélection locale',
    'Mon suivi',
    'Choisir ses candidats et ses thèmes.',
    'sage',
    tiles(
      [
        ['Candidats', candidates.length],
        ['Thèmes', themes.length],
      ],
      'Préférences conservées dans votre navigateur',
    ),
  ],
  [
    'dossiers',
    '/dossiers/',
    'Dossiers thématiques',
    'Les dossiers\nPolradar',
    'Programmes, chiffrages et méthode.',
    'clay',
    tiles(
      functions.map(([, label, n]) => [label, n]),
      'Explorer le corpus',
    ),
  ],
  [
    'sources',
    '/sources/',
    'Documents de référence',
    'Catalogue\ndes sources',
    'Retrouver les documents cités.',
    'sage',
    bars(
      counts(sources, 'kind').map((r) => ({
        ...r,
        label:
          {
            campagne: 'Campagnes',
            parti: 'Partis',
            institution: 'Institutions',
            presse: 'Presse',
            archive: 'Archives',
          }[r.label] || r.label,
      })),
      'sources référencées',
    ),
  ],
  [
    'methode',
    '/methode/',
    'Méthode éditoriale',
    'Comment lire\nPolradar',
    'Attributions, dates, périmètres et archives.',
    'ivory',
    {
      kind: 'document',
      rows: [
        'Identifier la proposition',
        'Lire le document officiel',
        'Distinguer les dates',
        'Conserver les versions',
      ],
    },
  ],
  [
    'reperes',
    '/reperes/',
    'L’élection présidentielle',
    'Calendrier\nélectoral',
    'Candidatures, scrutin et règles électorales.',
    'clay',
    {
      kind: 'document',
      rows: [
        'Candidatures',
        'Parrainages',
        'Deux tours de scrutin',
        'Résultats officiels',
      ],
    },
  ],
  [
    'finances-publiques',
    '/economie/finances-publiques/',
    'Contexte des programmes',
    'Repères\néconomiques',
    'Les données publiques et leurs sources.',
    'sage',
    {
      kind: 'document',
      rows: [
        'Unités et périodes',
        'Sources institutionnelles',
        'Montants datés',
        'Contexte des propositions',
      ],
    },
  ],
  [
    'recherche',
    '/recherche/',
    'Explorer le corpus',
    'Rechercher\nune proposition',
    'Candidats, thèmes et textes documentés.',
    'ivory',
    bars(themeBars.slice(-6)),
  ],
  [
    'mcp',
    '/mcp/',
    'Accès aux données',
    'Serveur MCP\nde Polradar',
    'Les propositions et leurs sources en lecture seule.',
    'navy',
    {
      kind: 'document',
      rows: [
        'Rechercher une proposition',
        'Lire les sources',
        'Consulter les candidatures',
        'Compter les contenus',
      ],
    },
  ],
  [
    'mcp-statistiques',
    '/mcp/statistiques/',
    'Données publiques',
    'Activité du\nserveur MCP',
    'Les appels par jour et par outil sur 30 jours.',
    'sage',
    {
      kind: 'document',
      rows: [
        'Appels quotidiens',
        'Réponses avec résultat',
        'Recherches sans résultat',
        'Erreurs des outils',
      ],
    },
  ],
  [
    'statistiques',
    '/statistiques/',
    'Données',
    'Le corpus\nen chiffres',
    'Propositions, orientations et archives.',
    'navy',
    bars(themeBars.slice(0, 6)),
  ],
  [
    'transparence',
    '/transparence/',
    'Le projet',
    'À propos\nde Polradar',
    'Un site indépendant consacré à la présidentielle.',
    'navy',
    tiles(
      [
        ['Candidatures', candidates.length],
        ['Thèmes', themes.length],
        ['Fiches actuelles', current.length],
        ['Scrutins documentés', votes.ballots.length],
      ],
      'Le corpus Polradar',
    ),
  ],
  [
    'mentions',
    '/mentions/',
    'Informations du site',
    'Mentions et\nconfidentialité',
    'Édition, données et hébergement.',
    'ivory',
    {
      kind: 'document',
      rows: [
        'Édition du site',
        'Données personnelles',
        'Hébergement',
        'Licence du projet',
      ],
    },
  ],
  [
    'credits-photos',
    '/credits-photos/',
    'Photographies',
    'Crédits\nphotographiques',
    'Auteurs, licences et conditions de réutilisation.',
    'clay',
    {
      kind: 'document',
      rows: [
        'Auteur identifié',
        'Source du fichier',
        'Licence vérifiée',
        'Conditions de réutilisation',
      ],
    },
  ],
];
export const socialImages = defs.map(
  ([id, path, kicker, title, description, palette, graphic]) => {
    const spec = {
      id,
      path,
      kicker,
      title,
      description,
      palette,
      graphic,
    };
    return {
      ...spec,
      file: `${id}.png`,
      url: `/og/${id}.png`,
      alt:
        id === 'mesures'
          ? 'Mesures et orientations. Répartition des fiches par thème dans le corpus Polradar.'
          : `Polradar · ${title.replaceAll('\n', ' ')}. ${description}`,
    };
  },
);
export function socialImageFor(pathname) {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return socialImages
    .filter((image) => path.startsWith(image.path))
    .sort((first, second) => second.path.length - first.path.length)[0];
}
