import { sourceCommit } from '../../../scripts/release-revision.mjs';
import { meta } from '../../lib/data';
const origin = 'https://polradar.fr';
const exports = [
  [
    'corpus',
    '/api/corpus.json',
    'Mesures, auteurs, versions, documents, candidatures et sondages',
  ],
  [
    'dossiers',
    '/api/dossiers.json',
    'Questions, votes nominatifs et évolutions',
  ],
  [
    'territoires',
    '/api/territoires.json',
    'Inventaire SRU et accessibilité aux généralistes par code INSEE',
  ],
  [
    'economie',
    '/api/economie.json',
    'Indicateurs, périodes, unités et statuts',
  ],
  [
    'budgets',
    '/api/budgets-programmes.json',
    'Montants, assiettes et financements documentés',
  ],
  ['agenda', '/api/agenda.json', 'Rendez-vous et références'],
  [
    'marches',
    '/api/marches-predictifs.json',
    'Observations par opérateur et dates des contrats',
  ],
];
export function GET() {
  return Response.json({
    version: 1,
    edition: meta.edition,
    revision: origin + '/build.json',
    contrat: origin + '/api/openapi.json',
    schemaCatalogue: origin + '/api/exports-v1.schema.json',
    sourceCommit,
    archive: sourceCommit
      ? `https://github.com/bluetouff/polradar/releases/download/site-${sourceCommit}/corpus-v1.tar.gz`
      : null,
    licence: {
      originaux: 'MIT',
      texte: 'https://github.com/bluetouff/polradar/blob/main/LICENSE',
      tiers:
        'Chaque source et chaque donnée de tiers garde ses conditions de réutilisation et son attribution.',
    },
    changements: [
      {
        version: '1.1',
        ajouts: [
          'Année de publication et références secondaires',
          'Statut de candidature, archives de versions',
          'Dossiers comparables et indicateurs communaux',
        ],
      },
    ],
    jeux: exports.map(([id, path, description]) => ({
      id,
      url: origin + path,
      description,
    })),
    exemples: [
      origin + '/api/v1/mesures?query=CSG&limit=3',
      origin + '/api/v1/donnees/economie/inflation',
    ],
  });
}
