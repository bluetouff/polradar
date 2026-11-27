import { footerColumns } from './footer-links';
import { groups, primaryNavigation } from './navigation';

const labels = new Map<string, string>([
  ...footerColumns.flatMap(({ links }) =>
    links.map(([url, label]) => [url, label] as const),
  ),
  ...groups.flatMap(({ links }) =>
    links.map(([url, label]) => [url, label] as const),
  ),
  ['/mesures/', 'Propositions'],
  ['/votes/recherche/', 'Rechercher les votes au Parlement'],
  ['/sondages/comparer/', 'Comparer les scénarios de sondage'],
  ['/sondages/notices/', 'Notices officielles'],
  ['/sondages/enquetes/', 'Autres enquêtes de campagne'],
  ['/mcp/documentation/', 'Documentation MCP'],
  ['/en/', 'English'],
]);

const families = [
  {
    id: 'programmes',
    shortLabel: 'Programmes',
    label: 'Programmes et votes',
    icon: 'mesures',
    urls: [
      '/mesures/',
      '/themes/',
      '/questions/',
      '/dossiers/',
      '/divergences/',
      '/evolution/',
      '/votes/',
      '/votes/recherche/',
      '/comparer/retraites/',
      '/numerique/comparer/',
      '/numerique/ce-qui-changerait/',
      '/numerique/',
      '/numerique/liberte-expression/',
    ],
  },
  {
    id: 'campagne',
    shortLabel: 'Campagne',
    label: 'Campagne et élections',
    icon: 'vote',
    urls: [
      '/campagne/',
      '/agenda/',
      '/reperes/',
      '/debats/',
      '/echiquier/',
      '/temps-de-parole/',
      '/argent-des-campagnes/',
      '/sondages/comparer/',
      '/sondages/notices/',
      '/sondages/enquetes/',
      '/marches-predictifs/',
      '/communes/',
    ],
  },
  {
    id: 'economie',
    shortLabel: 'Économie',
    label: 'Économie et territoires',
    icon: 'markets',
    urls: [
      '/economie/',
      '/economie/declarations/',
      '/territoires/',
      '/economie/finances-publiques/',
      '/economie/simulateur-budgetaire/',
      '/budget-programmes/',
      '/financements/',
    ],
  },
  {
    id: 'projet',
    shortLabel: 'Le projet',
    label: 'Le projet et ses sources',
    icon: 'source',
    urls: [
      '/sources/',
      '/methode/',
      '/veille/',
      '/mises-a-jour/',
      '/historique/',
      '/statistiques/',
      '/transparence/',
      '/licences/',
      '/credits-photos/',
      '/mentions/',
      '/rss.xml',
      '/en/',
    ],
  },
];

const professionalUrls = [
  '/donnees/',
  '/studio/',
  '/api/',
  '/mcp/',
  '/mcp/documentation/',
  '/mcp/statistiques/',
  '/presse/',
];
const primaryUrls = new Set(primaryNavigation.map(({ url }) => url));
const represented = new Set([
  ...primaryUrls,
  ...professionalUrls,
  ...families.flatMap(({ urls }) => urls),
]);
const toLink = (url: string) => ({ url, label: labels.get(url)! });

export const directorySections = families.map(({ urls, ...family }, index) => ({
  ...family,
  links: [
    ...urls,
    ...(index === families.length - 1
      ? [...labels.keys()].filter((url) => !represented.has(url))
      : []),
  ]
    .filter((url) => !primaryUrls.has(url))
    .map(toLink),
}));
export const directoryProfessionals = professionalUrls.map(toLink);
