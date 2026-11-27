export const groups = [
  {
    id: 'programmes',
    name: 'Programmes',
    icon: 'mesures',
    links: [
      ['/comparer/', 'Comparer les programmes', 'exchange'],
      ['/questions/', 'Toutes les questions', 'layers'],
      ['/mesures/', 'Mesures et orientations', 'mesures'],
      ['/themes/', 'Thèmes', 'layers'],
      ['/comparer/retraites/', 'Retraites et droit en vigueur', 'retraites'],
      ['/numerique/', 'Propositions sur le numérique', 'layers'],
      ['/numerique/liberte-expression/', 'Liberté d’expression', 'microphone'],
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
      ['/breves/', 'Brèves de campagne', 'source'],
      ['/debats/', 'Débats et entretiens', 'microphone'],
      ['/campagne/', 'Chronologie', 'historique'],
      ['/agenda/', 'Carte des rendez-vous', 'map-pin'],
      ['/argent-des-campagnes/', 'Argent des campagnes', 'euro'],
      ['/reperes/', 'Calendrier électoral', 'clock'],
      ['/communes/', 'Résultats par commune', 'institutions'],
      ['/territoires/', 'Les chiffres de ma commune', 'map-pin'],
    ],
  },
  {
    id: 'donnees',
    name: 'Données',
    icon: 'sondages',
    links: [
      ['/donnees/', 'Données ouvertes', 'donnees'],
      ['/studio/', 'Studio graphique', 'sondages'],
      ['/statistiques/', 'Le corpus en chiffres', 'donnees'],
      ['/mcp/statistiques/', 'Activité du serveur MCP', 'sondages'],
      ['/mises-a-jour/', 'Mises à jour', 'clock'],
      ['/economie/', 'Indicateurs économiques', 'markets'],
      ['/economie/simulateurs/', 'Simulateurs du quotidien', 'fiscalite'],
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
      [
        '/economie/simulateur-budgetaire/',
        'Simulateur des finances publiques',
        'fiscalite',
      ],
      ['/financements/', 'Carte des financements', 'exchange'],
    ],
  },
  {
    id: 'projet',
    name: 'Projet',
    icon: 'source',
    links: [
      ['/presse/', 'Espace presse et partenariats', 'microphone'],
      ['/dossiers/', 'Décryptages', 'source'],
      ['/veille/', 'Veille quotidienne', 'veille'],
      ['/sources/', 'Catalogue des sources', 'source'],
      ['/mcp/', 'Serveur MCP', 'layers'],
      ['/api/', 'API publique', 'donnees'],
      ['/historique/', 'Historique du corpus', 'historique'],
      ['/methode/', 'Méthode', 'check'],
      ['/licences/', 'Licences et crédits', 'source'],
      ['/mentions/', 'Mentions et confidentialité', 'source'],
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

export const primaryNavigation = [
  {
    url: '/candidats/',
    label: 'Candidats',
    sections: ['/candidats/', '/echiquier/', '/votes/', '/evolution/'],
  },
  {
    url: '/comparer/',
    label: 'Comparer',
    sections: [
      '/comparer/',
      '/questions/',
      '/mesures/',
      '/themes/',
      '/numerique/',
      '/divergences/',
      '/engagements/',
      '/budget-programmes/',
      '/financements/',
    ],
  },
  {
    url: '/economie/simulateurs/',
    label: 'Mon quotidien',
    sections: ['/economie/simulateurs/', '/territoires/', '/communes/'],
  },
  {
    url: '/sondages/',
    label: 'Sondages',
    sections: ['/sondages/', '/marches-predictifs/'],
  },
  {
    url: '/breves/',
    label: 'La campagne',
    sections: [
      '/breves/',
      '/campagne/',
      '/agenda/',
      '/reperes/',
      '/argent-des-campagnes/',
      '/temps-de-parole/',
    ],
  },
  { url: '/suivi/', label: 'Mon suivi', sections: ['/suivi/'] },
];
