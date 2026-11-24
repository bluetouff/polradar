import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const site = 'https://polradar.fr';
const liveIndex = site + '/api/documents.json';
const catalogue = site + '/api/exports-v1.json';
const catalogueDCAT = site + '/api/catalogue-dcat.json';
const licence = 'https://opendatacommons.org/licenses/odbl/1-0/';

export function prepareDatagouv(catalog, dcat, documentBytes) {
  const record = catalog.jeux?.find((item) => item.id === 'documents');
  const index = dcat['dcat:dataset']?.find(
    (item) => item['dct:identifier'] === 'documents',
  );
  const distribution = index?.['dcat:distribution']?.find(
    (item) => item['dcat:downloadURL']?.['@id'] === liveIndex,
  );
  const sha = catalog.sourceCommit;
  if (
    !/^[a-f0-9]{40}$/.test(sha) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(catalog.edition)
  )
    throw Error('Construire une édition datée portant sa révision Git.');
  const release =
    'https://github.com/bluetouff/polradar/releases/download/site-' + sha + '/';
  if (
    catalog.version !== 1 ||
    catalog.archive !== release + 'corpus-v1.tar.gz' ||
    catalog.catalogueDCAT !== catalogueDCAT ||
    catalog.licence?.originaux !== 'ODbL-1.0' ||
    record?.url !== liveIndex ||
    record.droits?.url !== licence ||
    index?.['dcat:version'] !== sha ||
    distribution?.['dct:license']?.['@id'] !== licence
  )
    throw Error(
      'L’index, ses droits et sa révision doivent correspondre dans les catalogues JSON et DCAT.',
    );
  const documents = JSON.parse(documentBytes);
  if (documents.schemaVersion !== 1 || !Array.isArray(documents.documents))
    throw Error('Le registre documentaire attendu manque dans cette édition.');

  return {
    dataset: {
      title:
        'Présidentielle française de 2027 : index documentaire de Polradar',
      description: [
        'Polradar recense les documents qui étayent ses fiches de campagne. Chaque entrée identifie une source et son adresse. Elle relie, lorsqu’ils sont documentés, la date de publication, les candidats, les thèmes et les repères de page ou de section.',
        'La sélection, les rapprochements et les annotations de Polradar forment une base sous ODbL 1.0. Les extraits cités et les documents référencés conservent les droits de leurs producteurs. [Conditions de réutilisation](https://polradar.fr/licences/).',
        'L’index évolue au fil des sources examinées. Pour citer une édition, ouvrir le [catalogue des exports](https://polradar.fr/api/exports-v1.json), puis retrouver `api/documents.json` dans l’archive indiquée. Le catalogue général [DCAT](https://polradar.fr/api/catalogue-dcat.json) décrit le périmètre et les droits des autres jeux.',
      ].join('\n\n'),
      license: 'odc-odbl',
      frequency: 'irregular',
      tags: [
        'election-presidentielle',
        'presidentielle-2027',
        'programmes-electoraux',
        'france',
      ],
    },
    resources: [
      {
        title: 'Index documentaire actualisé',
        description:
          'Un enregistrement par référence. Les listes de passages et les indications de couverture précisent les documents exploités.',
        type: 'main',
        filetype: 'remote',
        format: 'json',
        mime: 'application/json',
        url: liveIndex,
      },
      {
        title: 'Consulter les documents et leur couverture',
        description:
          'Parcourir les sources, leurs dates et leurs liens avec les fiches de campagne.',
        type: 'documentation',
        filetype: 'remote',
        format: 'html',
        mime: 'text/html',
        url: site + '/documents/',
      },
    ],
    edition: {
      date: catalog.edition,
      revision: sha,
      references: documents.documents.length,
      fichier: 'api/documents.json',
      sha256: createHash('sha256').update(documentBytes).digest('hex'),
      archive: catalog.archive,
      empreinteArchive: release + 'corpus-v1.sha256',
      catalogue,
      catalogueDCAT,
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const api = resolve('dist/api');
  const draft = prepareDatagouv(
    JSON.parse(readFileSync(resolve(api, 'exports-v1.json'), 'utf8')),
    JSON.parse(readFileSync(resolve(api, 'catalogue-dcat.json'), 'utf8')),
    readFileSync(resolve(api, 'documents.json')),
  );
  console.log(JSON.stringify(draft, null, 2));
}
