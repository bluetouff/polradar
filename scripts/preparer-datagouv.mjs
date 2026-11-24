// Render an import draft locally. Actual publication requires a portal account and an editorial review.
import { readFileSync } from 'node:fs';
const catalog = JSON.parse(readFileSync('dist/api/exports-v1.json', 'utf8'));
const data = JSON.parse(readFileSync('dist/api/documents.json', 'utf8'));
if (
  !/^[a-f0-9]{40}$/.test(catalog.sourceCommit) ||
  !catalog.archive ||
  !Array.isArray(data.documents)
)
  throw Error('Construire d’abord une édition immuable du site.');
console.log(
  JSON.stringify(
    {
      titre: 'Présidentielle de 2027 · index documentaire de Polradar',
      description:
        'Métadonnées originales de Polradar, références des producteurs et repères de lecture des documents de campagne.',
      producteur: 'Polradar',
      edition: catalog.edition,
      revision: catalog.sourceCommit,
      licence: 'ODbL-1.0',
      perimetre:
        'Sélection, rapprochement et annotation de références. Les documents originaux restent chez leurs producteurs.',
      documentation: 'https://polradar.fr/documents/',
      conditions: 'https://polradar.fr/licences/',
      ressourceActualisee: 'https://polradar.fr/api/documents.json',
      archiveVersionnee: catalog.archive,
      fichierDansArchive: 'api/documents.json',
      nombreDeReferences: data.documents.length,
      etat: 'Brouillon local à relire avant un éventuel dépôt authentifié.',
    },
    null,
    2,
  ),
);
