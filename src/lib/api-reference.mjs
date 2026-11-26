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
  'comparaisons-sondages',
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
const answerLink = object({ libelle: str, url });
const schemas = {
  MethodeComparativeSondages: object({
    fenetreJours: { ...count, minimum: 1, maximum: 366 },
    ponderation: str,
    export: url,
  }),
  QuestionDocumentaire: {
    ...object(
      {
        question: {
          ...str,
          minLength: 1,
          maxLength: 300,
          description: 'Question documentaire en français.',
        },
        expectedRevision: revisionFilter.schema,
      },
      ['question'],
    ),
    additionalProperties: false,
  },
  PreuveDocumentaire: object(
    {
      id: str,
      document: str,
      url,
      passage: str,
      publication: date,
      anneePublication: str,
      justificatifPublication: str,
      consultation: date,
    },
    ['id', 'document', 'url', 'passage'],
  ),
  ChiffreDocumentaire: object(
    {
      libelle: str,
      valeur: str,
      unite: str,
      periode: str,
      base: str,
      sourceId: str,
    },
    ['libelle', 'valeur'],
  ),
  RelationQuestionDocumentaire: object({
    id: str,
    qualification: { ...str, enum: ['reponse', 'complement'] },
    justification: str,
    statut: { ...str, enum: ['version-courante', 'version-depassee'] },
    versionCitee: str,
    versionCourante: str,
    regleVersion: { const: 'version-citee' },
  }),
  CouvertureComparaisonDocumentaire: object({
    candidaturesDemandees: { type: ['integer', 'null'], minimum: 0 },
    candidaturesIdentifiees: count,
    candidaturesTraitees: count,
    avecPosition: count,
    sansPosition: count,
    complementsSeuls: count,
    resultatsTronques: count,
  }),
  ComplementComparaisonDocumentaire: object(
    {
      id: str,
      versionId: str,
      titre: str,
      url,
      auteur: str,
      statut: str,
      resume: str,
      source: ref('PreuveDocumentaire'),
      relation: ref('RelationQuestionDocumentaire'),
    },
    ['id', 'versionId', 'titre', 'url', 'auteur', 'statut', 'resume'],
  ),
  DossierComparaisonDocumentaire: object({
    etat: { ...str, enum: ['position', 'complement-seul', 'non-documente'] },
    nombrePositions: count,
    nombreComplements: count,
    resultatsTronques: count,
    url,
    supplementaires: {
      ...array(ref('ComplementComparaisonDocumentaire')),
      maxItems: 3,
    },
  }),
  ReponseDocumentaire: {
    ...object(
      {
        etat: {
          ...str,
          enum: [
            'documente',
            'partiel',
            'sans-resultat',
            'ambigu',
            'hors-perimetre',
          ],
        },
        intention: {
          ...str,
          enum: [
            'comparaison',
            'economie',
            'financement',
            'historique',
            'inconnue',
            'juridique',
            'proposition',
            'scrutin',
            'simulation',
            'sondage',
            'source',
            'territoire',
            'verification',
          ],
        },
        titre: str,
        explication: str,
        motif: str,
        couverture: object(
          {
            perimetre: str,
            total: nextOffset,
            limite: count,
            url,
            comparaison: ref('CouvertureComparaisonDocumentaire'),
          },
          ['perimetre', 'total', 'limite', 'url'],
        ),
        resultats: {
          type: 'array',
          maxItems: 6,
          items: object(
            {
              id: str,
              versionId: str,
              candidatureAssociee: str,
              titre: str,
              resume: str,
              auteur: str,
              statut: str,
              date,
              typeDate: {
                ...str,
                enum: ['consultation', 'publication', 'scrutin', 'observation'],
              },
              url: { anyOf: [url, { const: '' }] },
              sources: { ...array(ref('PreuveDocumentaire')), maxItems: 6 },
              chiffres: { ...array(ref('ChiffreDocumentaire')), maxItems: 8 },
              relation: ref('RelationQuestionDocumentaire'),
              comparaison: ref('DossierComparaisonDocumentaire'),
            },
            ['id', 'titre', 'url', 'sources', 'chiffres'],
          ),
        },
        liens: array(answerLink),
      },
      [
        'etat',
        'intention',
        'titre',
        'explication',
        'couverture',
        'resultats',
        'liens',
      ],
    ),
    if: { properties: { intention: { const: 'comparaison' } } },
    else: { properties: { resultats: { maxItems: 3 } } },
  },
  ErreurDocumentaire: object({ code: str, erreur: str }),
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
      versionTransportCorpus: count,
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
          methodeComparative: ref('MethodeComparativeSondages'),
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
      methodeComparative: ref('MethodeComparativeSondages'),
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
    path: '/reponse',
    key: 'reponse',
    method: 'post',
    title: 'Question documentaire avec preuves et périmètre',
    returns: 'ReponseDocumentaire',
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
        'Titre ou adresse pour sources, texte ou identifiant pour parlement. Institut, commanditaire, scénario, identifiant ou date AAAA-MM-JJ pour sondages. Titre, description ou code pour economie. Intitulé ou identifiant pour comparaisons-sondages.',
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
function responses(data, head, post = false) {
  const errorsByMethod = post
    ? {
        400: errors[400],
        403: 'Origine refusée.',
        405: errors[405],
        409: errors[409],
        413: 'Taille maximale de la requête ou de la réponse dépassée.',
        415: 'Le corps doit être en JSON UTF-8.',
        429: errors[429],
        503: errors[503],
      }
    : errors;
  const result = Object.fromEntries(
    Object.entries(errorsByMethod).map(([code, description]) => [
      code,
      head
        ? { description }
        : {
            description,
            content: json(ref(post ? 'ErreurDocumentaire' : 'Erreur')),
          },
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
    apiRoutes.map(({ path, key, title, returns, params, method }) => [
      path,
      method === 'post'
        ? {
            post: {
              operationId: key,
              summary: title,
              description:
                'Lecture seule à partir du service 1.6. Transmettez la question dans le corps JSON. Pour une requête avec Origin, utilisez https://polradar.fr.',
              requestBody: {
                required: true,
                content: json(ref('QuestionDocumentaire')),
              },
              responses: responses(returns, false, true),
            },
          }
        : {
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
