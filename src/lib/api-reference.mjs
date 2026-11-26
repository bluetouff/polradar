const str = { type: 'string' };
const date = { type: 'string', format: 'date' };
const url = { type: 'string', format: 'uri' };
const count = { type: 'integer', minimum: 0 };
const scope = {
  type: 'string',
  enum: ['campagne', 'parti', 'orientation', 'archive'],
};
const array = (items) => ({ type: 'array', items });
const ref = (name) => ({ $ref: '#/components/schemas/' + name });
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
});
const filter = (name, schema, description) => ({
  name,
  in: 'query',
  schema,
  description,
});
const segment = (name, schema, description) => ({
  name,
  in: 'path',
  required: true,
  schema,
  description,
});
const id = segment(
  'id',
  { ...str, minLength: 1, maxLength: 160 },
  'Identifiant exact obtenu dans la liste.',
);
const collections = [
  'sondages',
  'economie',
  'agenda',
  'budgets',
  'marches',
  'parlement',
  'senat',
  'parlement-europeen',
  'sources',
  'droit',
  'verifications',
  'breves',
  'financements',
  'arcom',
  'graphiques',
];
const collection = segment(
  'collection',
  { ...str, enum: collections },
  'Jeu de données publié.',
);
const offset = filter(
  'offset',
  { ...count, maximum: 100000, default: 0 },
  'Position du premier résultat, à partir de zéro.',
);
const paging = { total: count, offset: count };
const maybeText = { type: ['string', 'null'] };
const revisionFilter = filter(
  'expectedRevision',
  { ...str, pattern: '^[0-9a-f]{40}$' },
  'Révision rendue au premier appel. Une révision différente renvoie HTTP 409.',
);
const fiche = {
  id: str,
  titre: str,
  auteur: str,
  candidatureAssociee: str,
  statutCandidature: str,
  dateRetrait: maybeText,
  sourceStatut: maybeText,
  theme: str,
  statut: scope,
  edition: str,
  verifieLe: date,
  url,
};
const evidence = {
  description: str,
  chiffres: { type: ['array', 'null'], items: { type: 'object' } },
  montants: { type: ['array', 'null'], items: { type: 'object' } },
  beneficiaires: maybeText,
  echeance: maybeText,
  financement: maybeText,
  sources: array(ref('Source')),
};
const nextOffset = { type: ['integer', 'null'], minimum: 0 };
const schemas = {
  Source: object({
    document: str,
    url,
    passage: str,
    publication: { type: ['string', 'null'], format: 'date' },
    id: str,
    anneePublication: maybeText,
    justificatifPublication: maybeText,
    consultation: date,
  }),
  Mesure: object(
    {
      ...fiche,
      source: ref('Source'),
      resume: str,
      urlVersion: { ...maybeText, format: 'uri' },
      preuves: object(evidence),
    },
    [...Object.keys(fiche), 'source'],
  ),
  Fiche: object(
    {
      ...fiche,
      ...evidence,
      revision: count,
      urlVersion: { ...maybeText, format: 'uri' },
      versions: array({ type: 'object' }),
      liensDossier: { type: 'object' },
      liensDossierCourant: {
        type: 'object',
        description:
          'Rapprochements disponibles dans l’édition courante du corpus.',
      },
      statutCandidatureActuel: str,
      versionDemandee: maybeText,
    },
    [
      ...Object.keys(fiche),
      'description',
      'revision',
      'chiffres',
      'montants',
      'beneficiaires',
      'echeance',
      'financement',
      'versions',
      'liensDossier',
      'versionDemandee',
      'sources',
    ],
  ),
  Candidat: object(
    {
      id: str,
      nom: str,
      statut: str,
      organisation: str,
      url,
      retrait: date,
      sourceStatut: url,
    },
    ['id', 'nom', 'statut', 'organisation', 'url'],
  ),
  Index: object({
    version: { const: '1' },
    documentation: url,
    openapi: url,
    ressources: array(str),
  }),
  Corpus: object(
    {
      campagne: count,
      parti: count,
      orientations: count,
      archives: count,
      sources: count,
      themes: array(object({ id: str, label: str })),
      contratsCollections: {
        type: 'object',
        additionalProperties: object({
          version: count,
          compatible: { type: 'boolean' },
        }),
      },
      url,
    },
    [
      'campagne',
      'parti',
      'orientations',
      'archives',
      'sources',
      'themes',
      'url',
    ],
  ),
  Candidatures: object({ candidatures: array(ref('Candidat')) }),
  Mesures: object(
    { ...paging, resultats: array(ref('Mesure')), suivant: nextOffset },
    [...Object.keys(paging), 'resultats'],
  ),
  Publications: {
    oneOf: [
      object(
        {
          ...paging,
          suivant: nextOffset,
          collection: collection.schema,
          rubrique: url,
          publications: array(
            object(
              {
                id: str,
                titre: str,
                date: str,
                institut: str,
                commanditaire: str,
                terrainDu: date,
                terrainAu: date,
                notice: url,
              },
              ['id', 'titre'],
            ),
          ),
        },
        [...Object.keys(paging), 'collection', 'rubrique', 'publications'],
      ),
      object({
        collection: { enum: ['senat', 'parlement-europeen'] },
        rubrique: url,
        couverture: { const: 'periode-non-couverte' },
        periodeDemandee: str,
        publication: { type: 'null' },
        periodes: array({ type: 'object' }),
        jeuVerifieLe: date,
        droitsSource: { type: 'object' },
        index: url,
      }),
    ],
  },
  Publication: object(
    {
      collection: collection.schema,
      rubrique: url,
      publication: {
        type: 'object',
        description:
          'Enregistrement du jeu choisi avec ses champs d’origine, notamment dates, unités et références.',
      },
      source: { type: 'object' },
      lectureObservations: str,
      lecture: str,
    },
    ['collection', 'rubrique', 'publication'],
  ),
  Erreur: object({ erreur: str }),
};
export const apiRoutes = [
  {
    path: '/',
    key: 'index',
    title: 'Découvrir les ressources',
    returns: 'Index',
    params: [],
  },
  {
    path: '/corpus',
    key: 'corpus',
    title: 'Compter les fiches par statut et retrouver les thèmes',
    returns: 'Corpus',
    params: [],
  },
  {
    path: '/candidats',
    key: 'candidats',
    title: 'Lister les candidatures et leur statut',
    returns: 'Candidatures',
    params: [
      filter(
        'includeWithdrawn',
        { type: 'boolean', default: false },
        'Inclure les candidatures retirées.',
      ),
    ],
  },
  {
    path: '/mesures',
    key: 'mesures',
    title: 'Chercher des propositions',
    returns: 'Mesures',
    params: [
      filter(
        'query',
        { ...str, minLength: 1, maxLength: 160 },
        'Mots du titre, du résumé, de l’auteur, de la candidature ou du thème.',
      ),
      filter(
        'candidate',
        { ...str, minLength: 1, maxLength: 96 },
        'Identifiant de la candidature associée.',
      ),
      filter(
        'theme',
        { ...str, minLength: 1, maxLength: 96 },
        'Identifiant du thème dans /corpus.',
      ),
      filter('scope', scope, 'Les archives sont exclues par défaut.'),
      filter(
        'candidateStatus',
        { ...str, enum: ['toutes', 'actives', 'retirees'], default: 'toutes' },
        'Statut de la candidature associée. Le texte de parti conserve son auteur.',
      ),
      filter(
        'sort',
        { ...str, enum: ['pertinence', 'alphabetique'] },
        'Ordre des résultats.',
      ),
      filter(
        'mode',
        { ...str, enum: ['preuves'] },
        'Service 1.5. Inclure les conditions, chiffres et tous les passages dans chaque résultat.',
      ),
      filter(
        'limit',
        { type: 'integer', minimum: 1, maximum: 25 },
        'Jusqu’à 25 fiches (10 par défaut). En mode preuves, jusqu’à 5 (3 par défaut).',
      ),
      offset,
    ],
  },
  {
    path: '/mesures/{id}',
    key: 'mesure',
    title: 'Lire une proposition et toutes ses sources',
    returns: 'Fiche',
    params: [
      id,
      filter(
        'version',
        { type: 'integer', minimum: 1 },
        'Version historique de la mesure.',
      ),
    ],
  },
  {
    path: '/donnees/{collection}',
    key: 'publications',
    title: 'Parcourir un jeu de données, 15 entrées par page',
    returns: 'Publications',
    params: [
      collection,
      offset,
      filter(
        'periode',
        str,
        'Année de début de session pour senat ou date AAAA-MM-JJ pour parlement-europeen.',
      ),
      filter(
        'query',
        { ...str, maxLength: 160 },
        'Titre ou adresse pour sources, texte ou identifiant pour parlement. Avec le service 1.5, institut, commanditaire, scénario, identifiant ou date AAAA-MM-JJ pour sondages, titre, description ou code pour economie.',
      ),
      filter(
        'recherche',
        { type: 'boolean' },
        'Avec parlement, inclut les trois institutions, les dépôts et les interventions.',
      ),
      filter(
        'candidat',
        str,
        'Identifiant du candidat dans la recherche parlementaire.',
      ),
      filter(
        'institution',
        { type: 'string', enum: ['assemblee', 'senat', 'parlement-europeen'] },
        'Institution du registre parlementaire.',
      ),
      filter('debut', date, 'Première date incluse.'),
      filter('fin', date, 'Dernière date incluse.'),
      filter(
        'nature',
        {
          type: 'string',
          enum: [
            'vote',
            'depot',
            'rapport',
            'intervention',
            'cosignature',
            'mise-au-point',
          ],
        },
        'Nature de l’acte ou du rôle documenté.',
      ),
      filter(
        'position',
        {
          type: 'string',
          enum: [
            'pour',
            'contre',
            'abstention',
            'non-votant',
            'non-votant-volontaire',
          ],
        },
        'Vote enregistré pour la personne filtrée.',
      ),
      filter('theme', str, 'Thème du registre parlementaire, dont numerique.'),
    ],
  },
  {
    path: '/donnees/{collection}/{id}',
    key: 'publication',
    title: 'Lire un relevé et ses références',
    returns: 'Publication',
    params: [collection, id],
  },
];
const errors = {
  400: 'Paramètres ou corps de requête invalides.',
  404: 'Identifiant ou ressource introuvable.',
  405: 'Méthode non autorisée.',
  409: 'La révision du site a changé.',
  429: 'Quota atteint.',
  503: 'Service ou données temporairement indisponibles.',
};
const json = (schema) => ({ 'application/json': { schema } });
function responses(data, head) {
  const result = Object.fromEntries(
    Object.entries(errors).map(([code, description]) => [
      code,
      head ? { description } : { description, content: json(ref('Erreur')) },
    ]),
  );
  result['200'] = head
    ? { description: 'Ressource disponible, réponse sans corps.' }
    : {
        description: 'Réponse du corpus public.',
        content: json(
          object(
            {
              corpusVerifieLe: date,
              versionContrat: { type: 'integer', minimum: 1 },
              revisionDuSite: { ...str, pattern: '^[0-9a-f]{40}$' },
              revisionDuService: maybeText,
              sansResultat: { type: 'boolean' },
              donnees: ref(data),
            },
            [
              'corpusVerifieLe',
              'revisionDuSite',
              'revisionDuService',
              'sansResultat',
              'donnees',
            ],
          ),
        ),
      };
  return result;
}
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'API publique de Polradar',
    version: '1.0.0',
    description:
      'Lecture du corpus de la présidentielle française. Les résultats conservent l’auteur, les sources et la révision publiée.',
  },
  servers: [{ url: 'https://polradar.fr/api/v1' }],
  externalDocs: {
    description: 'Guide de l’API',
    url: 'https://polradar.fr/api/',
  },
  security: [],
  paths: Object.fromEntries(
    apiRoutes.map(({ path, key, title, returns, params }) => [
      path,
      {
        parameters: [...params, revisionFilter],
        get: {
          operationId: key,
          summary: title,
          responses: responses(returns, false),
        },
        head: {
          operationId: key + 'Head',
          summary: 'Vérifier la disponibilité de cette ressource',
          responses: responses(returns, true),
        },
      },
    ]),
  ),
  components: { schemas },
};
