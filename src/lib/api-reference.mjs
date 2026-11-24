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
const collections = ['sondages', 'economie', 'agenda', 'budgets', 'marches'];
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
const fiche = {
  id: str,
  titre: str,
  auteur: str,
  candidatureAssociee: str,
  theme: str,
  statut: scope,
  edition: str,
  verifieLe: date,
  url,
};
const schemas = {
  Source: object({
    document: str,
    url,
    passage: str,
    publication: { type: ['string', 'null'], format: 'date' },
    consultation: date,
  }),
  Mesure: object({ ...fiche, source: ref('Source') }),
  Fiche: object({
    ...fiche,
    description: str,
    revision: count,
    chiffres: { type: ['array', 'null'], items: { type: 'object' } },
    sources: array(ref('Source')),
  }),
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
  Corpus: object({
    campagne: count,
    parti: count,
    orientations: count,
    archives: count,
    sources: count,
    themes: array(object({ id: str, label: str })),
    url,
  }),
  Candidatures: object({ candidatures: array(ref('Candidat')) }),
  Mesures: object({ ...paging, resultats: array(ref('Mesure')) }),
  Publications: object({
    ...paging,
    collection: collection.schema,
    rubrique: url,
    publications: array(
      object({ id: str, titre: str, date: str }, ['id', 'titre']),
    ),
  }),
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
        'limit',
        { type: 'integer', minimum: 1, maximum: 25, default: 10 },
        'Nombre maximal de fiches renvoyées.',
      ),
      offset,
    ],
  },
  {
    path: '/mesures/{id}',
    key: 'mesure',
    title: 'Lire une proposition et toutes ses sources',
    returns: 'Fiche',
    params: [id],
  },
  {
    path: '/donnees/{collection}',
    key: 'publications',
    title: 'Parcourir un jeu de données, 15 entrées par page',
    returns: 'Publications',
    params: [collection, offset],
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
          object({
            corpusVerifieLe: date,
            revisionDuSite: { ...str, pattern: '^[0-9a-f]{40}$' },
            sansResultat: { type: 'boolean' },
            donnees: ref(data),
          }),
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
        parameters: params,
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
