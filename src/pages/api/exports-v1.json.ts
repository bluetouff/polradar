import { sourceCommit } from '../../../scripts/release-revision.mjs';
import { meta } from '../../lib/data';
import { dataLicence, publicExports } from '../../lib/public-exports.mjs';
const origin = 'https://polradar.fr';
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
    licence: dataLicence,
    catalogueDCAT: origin + '/api/catalogue-dcat.json',
    changements: [
      {
        version: '1.2',
        ajouts: [
          'Licence ODbL de la base originale',
          'Documentation et provenance de chaque export',
        ],
      },
      {
        version: '1.1',
        ajouts: [
          'Année de publication et références secondaires',
          'Statut de candidature, archives de versions',
          'Dossiers comparables et indicateurs communaux',
        ],
      },
    ],
    jeux: publicExports.map((jeu) => ({
      id: jeu.id,
      url: origin + jeu.path,
      description: jeu.description,
      unite: jeu.unit,
      provenance: jeu.provenance,
      limites: jeu.limits,
      droits: {
        libelle: jeu.rights.label,
        url: jeu.rights.url,
        perimetre: jeu.rights.scope,
      },
      champs: jeu.fields,
      documentation: origin + '/donnees/#' + jeu.id,
      format: 'application/json',
      edition: meta.edition,
    })),
    exemples: [
      origin + '/api/v1/mesures?query=CSG&limit=3',
      origin + '/api/v1/donnees/economie/inflation',
    ],
  });
}
