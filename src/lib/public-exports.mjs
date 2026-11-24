// Ces chemins désignent uniquement des fichiers publics construits par Polradar.
export const publicExports = [
  {
    id: 'corpus',
    title: 'Corpus de campagne',
    path: '/api/corpus.json',
    description: 'Propositions, candidatures, sources et versions',
    unit: 'Une fiche par identifiant. Chaque révision est un instantané distinct.',
    provenance:
      'Programmes, entretiens et publications référencés par les fiches.',
    limits:
      'Le champ scope distingue campagne, parti, orientation et archive. Une position de parti garde son auteur collectif.',
    fields: ['candidates', 'sources', 'measures', 'versions', 'polls'],
  },
  {
    id: 'dossiers',
    title: 'Votes et évolutions',
    path: '/api/dossiers.json',
    description: 'Votes nominatifs et évolutions documentées',
    unit: 'Un dossier relie des faits à des références nominatives.',
    provenance: 'Scrutins publics et versions datées de propositions.',
    limits:
      'Le lien traite d’un objet précis. Un vote sur un texte ne résume pas une position sur tout un thème.',
    fields: ['versionDocuments', 'questions', 'votes', 'evolutions'],
  },
  {
    id: 'territoires',
    title: 'Données communales',
    path: '/api/territoires.json',
    description: 'Logement social et accès aux généralistes',
    unit: 'Une observation par code Insee et par dispositif.',
    provenance:
      'Inventaire SRU et accessibilité potentielle localisée de la Drees.',
    limits:
      'Les millésimes, champs géographiques et unités diffèrent selon l’indicateur.',
    fields: ['names', 'sru', 'apl', 'definitions'],
  },
  {
    id: 'economie',
    title: 'Indicateurs économiques',
    path: '/api/economie.json',
    description: 'Séries économiques et déclarations examinées',
    unit: 'Une observation datée par série, avec son unité.',
    provenance: 'Producteurs indiqués dans chaque série et sa source.',
    limits:
      'Une révision statistique peut modifier une période ancienne. Lire le millésime et la définition.',
    fields: ['series', 'collectedAt', 'statements'],
  },
  {
    id: 'budgets',
    title: 'Budgets des programmes',
    path: '/api/budgets-programmes.json',
    description: 'Chiffrages et montants déclarés',
    unit: 'Un montant annoncé avec son horizon et sa source.',
    provenance: 'Documents de campagne et publications budgétaires attribués.',
    limits:
      'Un montant annuel et un total pluriannuel ne s’additionnent pas. Une valeur absente reste inconnue.',
    fields: ['entries', 'sources'],
  },
  {
    id: 'agenda',
    title: 'Agenda de campagne',
    path: '/api/agenda.json',
    description: 'Réunions, intervenants et lieux annoncés',
    unit: 'Un rendez-vous documenté à la date indiquée.',
    provenance: 'Organisateurs et références indiqués sur le rendez-vous.',
    limits:
      'Une invitation établit la programmation. La participation effective exige une source distincte.',
    fields: ['events', 'cities', 'sourceChecks'],
  },
  {
    id: 'marches',
    title: 'Marchés prédictifs',
    path: '/api/marches-predictifs.json',
    description: 'Prix observés sur les contrats suivis',
    unit: 'Une observation horodatée par contrat et par opérateur.',
    provenance:
      'Opérateur, question du contrat et horodatage associés à l’observation.',
    limits:
      'Le prix varie avec les échanges et dépend des règles du contrat. Les droits des opérateurs s’appliquent aux données sources.',
    fields: ['providers'],
  },
];
export const dataLicence = {
  originaux: 'ODbL-1.0',
  texte: 'https://opendatacommons.org/licenses/odbl/1-0/',
  conditions: 'https://polradar.fr/licences/',
  tiers:
    'Chaque document, série importée et photographie conserve les conditions de son producteur.',
};
