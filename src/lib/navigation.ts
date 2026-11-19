export const groups = [
  {
    id: 'programmes',
    name: 'Programmes',
    icon: 'mesures',
    links: [
      ['/mesures/', 'Mesures et orientations', 'mesures'],
      ['/themes/', 'Thèmes', 'layers'],
      ['/comparer/', 'Comparer les programmes', 'exchange'],
      ['/comparer/retraites/', 'Retraites et droit en vigueur', 'retraites'],
      ['/numerique/', 'Propositions sur le numérique', 'layers'],
      [
        '/numerique/ce-qui-changerait/',
        'Numérique et droit en vigueur',
        'chiffrement',
      ],
      ['/divergences/', 'Carte des divergences', 'exchange'],
    ],
  },
  {
    id: 'candidats',
    name: 'Candidats',
    icon: 'people',
    links: [
      ['/candidats/', 'Fiches des candidats', 'people'],
      ['/echiquier/', 'Échiquier politique', 'sondages'],
      ['/votes/', 'Propositions et votes passés', 'vote'],
      ['/evolution/', 'Évolution des propositions', 'historique'],
      ['/suivi/', 'Mon suivi', 'suivi'],
    ],
  },
  {
    id: 'campagne',
    name: 'Campagne',
    icon: 'historique',
    links: [
      ['/campagne/', 'Chronologie', 'historique'],
      ['/agenda/', 'Carte des rendez-vous', 'map-pin'],
      ['/reperes/', 'Calendrier électoral', 'clock'],
      ['/communes/', 'Résultats par commune', 'institutions'],
    ],
  },
  {
    id: 'donnees',
    name: 'Données',
    icon: 'sondages',
    links: [
      ['/economie/', 'Indicateurs économiques', 'markets'],
      [
        '/economie/finances-publiques/',
        'Comptes publics de référence',
        'fiscalite',
      ],
      ['/economie/declarations/', 'Déclarations et chiffres publics', 'source'],
      ['/sondages/', 'Sondages', 'sondages'],
      ['/marches-predictifs/', 'Marchés prédictifs', 'markets'],
      ['/temps-de-parole/', 'Temps de parole', 'microphone'],
      ['/budget-programmes/', 'Budgets des programmes', 'euro'],
      ['/financements/', 'Carte des financements', 'exchange'],
    ],
  },
  {
    id: 'projet',
    name: 'Projet',
    icon: 'source',
    links: [
      ['/dossiers/', 'Dossiers', 'source'],
      ['/veille/', 'Veille quotidienne', 'veille'],
      ['/sources/', 'Catalogue des sources', 'source'],
      ['/historique/', 'Historique du corpus', 'historique'],
      ['/methode/', 'Méthode', 'check'],
      ['/transparence/', 'À propos de Polradar', 'institutions'],
    ],
  },
];

const entries = groups
  .flatMap((group) => group.links.map(([url]) => ({ url, group: group.id })))
  .sort((a, b) => b.url.length - a.url.length);

export function navigationFor(path: string, section: string) {
  const entry =
    entries.find(({ url }) => path.startsWith(url)) ??
    entries.find(({ url }) => url === section);
  return {
    current: entry?.url ?? section,
    desk:
      entry?.group ??
      (path.startsWith('/engagements/') ? 'programmes' : 'projet'),
  };
}
