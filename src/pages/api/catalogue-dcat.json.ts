import { dataLicence, publicExports } from '../../lib/public-exports.mjs';
import { meta } from '../../lib/data';
import { sourceCommit } from '../../../scripts/release-revision.mjs';
export function GET() {
  const root = 'https://polradar.fr';
  const publisher = {
    '@type': 'foaf:Organization',
    'foaf:name': 'Polradar',
    'foaf:homepage': { '@id': root + '/' },
  };
  return new Response(
    JSON.stringify({
      '@context': {
        dcat: 'http://www.w3.org/ns/dcat#',
        dct: 'http://purl.org/dc/terms/',
        foaf: 'http://xmlns.com/foaf/0.1/',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
      },
      '@type': 'dcat:Catalog',
      '@id': root + '/donnees/',
      'dct:title': 'Données publiques de Polradar',
      'dct:language': 'fr',
      'dct:publisher': publisher,
      'dcat:dataset': publicExports.map((j) => ({
        '@type': 'dcat:Dataset',
        '@id': root + '/donnees/#' + j.id,
        'dct:title': j.title,
        'dct:identifier': j.id,
        'dct:description': j.description + '. ' + j.unit + ' ' + j.limits,
        'dct:source': j.provenance,
        'dct:publisher': publisher,
        'dct:rights': { '@id': root + '/licences/' },
        'dcat:version': sourceCommit ?? meta.edition,
        'dcat:distribution': [
          {
            '@type': 'dcat:Distribution',
            'dcat:downloadURL': { '@id': root + j.path },
            'dct:format': 'application/json',
            'dct:rights': { '@id': dataLicence.conditions },
          },
        ],
      })),
    }),
    { headers: { 'Content-Type': 'application/ld+json; charset=utf-8' } },
  );
}
