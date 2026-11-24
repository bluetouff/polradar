import type { Graphic } from './chart-publication';
import { escapeHtml } from './escape-html.mjs';
export const studioRights = {
  author: 'Polradar · bluetouff',
  work: 'CC BY 4.0',
  workUrl: 'https://creativecommons.org/licenses/by/4.0/',
  database: 'ODbL 1.0 · base originale de Polradar',
  thirdParty:
    'Les données et documents des tiers gardent les conditions indiquées par leurs producteurs.',
  identity: 'Nom, logo et identité de Polradar : droits réservés.',
  policy: 'https://polradar.fr/licences/',
};
export function creditStudioGraphic(graphic: Graphic): Graphic {
  const width = graphic.width,
    height = graphic.height + 52;
  const metadata = JSON.stringify({
    ...studioRights,
    sourcePage: graphic.page,
    date: graphic.dateLabel,
    sources: graphic.sources,
  });
  const note = 'Graphique Polradar · CC BY 4.0';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    width +
    '" height="' +
    height +
    '" viewBox="0 0 ' +
    width +
    ' ' +
    height +
    '" role="img" aria-labelledby="studio-titre studio-description"><title id="studio-titre">' +
    escapeHtml(graphic.title) +
    '</title><desc id="studio-description">' +
    escapeHtml(graphic.alt) +
    '</desc><metadata>' +
    escapeHtml(metadata) +
    '</metadata>' +
    graphic.svg +
    '<rect x="0" y="' +
    graphic.height +
    '" width="' +
    width +
    '" height="52" fill="#edf4f4"/><g font-family="system-ui,sans-serif" fill="#254e59"><text x="20" y="' +
    (graphic.height + 22) +
    '" font-size="15" font-weight="600">' +
    note +
    '</text><text x="20" y="' +
    (graphic.height + 42) +
    '" font-size="13">Droits des données et crédits · polradar.fr/licences/</text></g></svg>';
  return { ...graphic, svg, height };
}
