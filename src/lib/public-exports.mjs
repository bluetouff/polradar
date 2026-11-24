// Ces chemins désignent uniquement des fichiers publics construits par Polradar.
const datasets = [
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
  {
    id: 'documents',
    title: 'Documents et passages',
    path: '/api/documents.json',
    description: 'Registre documentaire et passages cités dans les fiches',
    unit: 'Une référence avec ses usages, dates et repères.',
    provenance:
      'Catalogue de Polradar et pièces référencées dans les propositions.',
    limits:
      'Un titre ou un lien seul ne permet pas de conclure qu’un programme a été intégralement dépouillé.',
    fields: ['documents', 'coverageUnit'],
  },
  {
    id: 'notices-sondages',
    title: 'Notices de sondages',
    path: '/api/notices-sondages.json',
    description: 'Inventaire de la Commission des sondages et état de lecture',
    unit: 'Une entrée identifiée au catalogue de la Commission.',
    provenance:
      'Commission des sondages. Le fichier référence la notice publique.',
    limits:
      'Une notice identifiée peut encore être à relire, ou porter sur l’opinion. Ces statuts sont distincts des scénarios d’intentions de vote.',
    fields: ['checkedAt', 'lastSuccessAt', 'notices'],
  },
  {
    id: 'registre-assemblee',
    title: 'Scrutins de l’Assemblée nationale',
    path: '/api/parlement/assemblee.json',
    description:
      'Scrutins avec une position ou une mise au point nominative documentée',
    unit: 'Un scrutin, avec les positions enregistrées et les éventuelles mises au point.',
    provenance:
      'Archives des XVe et XVIe législatures de l’Assemblée nationale.',
    limits:
      'Le registre porte sur les personnes et mandats identifiés. Une absence de position enregistrée ne permet pas de déduire une absence en séance.',
    fields: ['scrutins', 'personnes', 'mandats'],
  },
  {
    id: 'breves',
    title: 'Brèves de campagne',
    path: '/api/documentation/breves.json',
    description: 'Publications éditoriales et signalements documentés',
    unit: 'Une brève datée, reliée au fait d’origine.',
    provenance: 'Rédaction Polradar et publications citées pour chaque fait.',
    limits:
      'La date de publication de la brève peut être postérieure à celle du fait.',
    fields: ['items'],
  },
  {
    id: 'droit',
    title: 'Droit en vigueur',
    path: '/api/documentation/droit.json',
    description: 'Droit en vigueur et textes cités',
    unit: 'Une règle documentée dans les comparatifs.',
    provenance: 'Textes et producteurs publics indiqués dans le comparatif.',
    limits:
      'Lire la date de validité et le champ d’application de chaque règle.',
    fields: ['items'],
  },
  {
    id: 'verifications',
    title: 'Vérifications des déclarations',
    path: '/api/documentation/verifications.json',
    description: 'Déclarations examinées et séries de référence',
    unit: 'Une comparaison de périmètres et de chiffres.',
    provenance: 'Déclaration d’origine et producteur de l’indicateur cité.',
    limits:
      'Les dates, les unités et les éventuelles révisions déterminent la comparaison.',
    fields: ['items'],
  },
  {
    id: 'financements',
    title: 'Financements annoncés',
    path: '/api/documentation/financements.json',
    description: 'Enveloppes, dépenses et contributions',
    unit: 'Un schéma documenté avec ses références.',
    provenance: 'Annonces des candidats et de leurs partis.',
    limits:
      'Les affectations sans montant restent distinctes des postes chiffrés.',
    fields: ['items'],
  },
  {
    id: 'arcom',
    title: 'Temps de parole Arcom',
    path: '/api/documentation/arcom.json',
    description: 'Relevés audiovisuels documentés',
    unit: 'Un relevé lié à une période et à un média.',
    provenance: 'Arcom, selon les relevés et unités cités.',
    limits: 'Période et médias couverts conditionnent les comparaisons.',
    fields: ['items'],
  },
  {
    id: 'graphiques',
    title: 'Graphiques intégrables',
    path: '/api/documentation/graphiques.json',
    description: 'Catalogue des liens actualisés et figés',
    unit: 'Un graphique et ses sources.',
    provenance: 'Polradar et producteurs identifiés pour chaque graphique.',
    limits:
      'La licence de la création graphique est distincte des droits sur les données représentées.',
    fields: ['items'],
  },
];

// La licence de l'assemblage ne se substitue pas aux droits sur son contenu.
const editorialIndex = {
  label: 'ODbL 1.0 pour la base originale',
  url: 'https://opendatacommons.org/licenses/odbl/1-0/',
  scope:
    'Sélection, rapprochements et annotations de Polradar. Les documents et données cités gardent les conditions de leur producteur.',
};
const originalWorks = {
  ...editorialIndex,
  scope:
    'Index sous ODbL 1.0. Les articles, illustrations et graphiques originaux de Polradar sont sous CC BY 4.0. Les données et documents cités conservent leurs conditions.',
};
const upstreamData = {
  label: 'Conditions des producteurs',
  url: null,
  scope:
    'Chaque série ou relevé conserve les conditions de son producteur, identifié dans le fichier.',
};
const rightsByDataset = new Map([
  [
    'registre-assemblee',
    {
      label: 'Licence Ouverte de l’Assemblée nationale',
      url: 'https://data.assemblee-nationale.fr/licence-ouverte-open-licence',
      scope:
        'Scrutins et mandats publiés par l’Assemblée nationale. Citer l’Assemblée et la version des archives utilisées.',
    },
  ],
  ['territoires', upstreamData],
  ['economie', upstreamData],
  ['arcom', upstreamData],
  ['marches', upstreamData],
  ['breves', originalWorks],
  ['graphiques', originalWorks],
]);
export const publicExports = datasets.map((dataset) => ({
  ...dataset,
  rights: rightsByDataset.get(dataset.id) ?? editorialIndex,
}));

export const dataLicence = {
  originaux: 'ODbL-1.0',
  texte: 'https://opendatacommons.org/licenses/odbl/1-0/',
  conditions: 'https://polradar.fr/licences/',
  matrice: 'https://polradar.fr/api/licences.json',
  oeuvresOriginales: 'CC-BY-4.0',
  tiers:
    'Chaque document, série importée et photographie conserve les conditions de son producteur.',
};
