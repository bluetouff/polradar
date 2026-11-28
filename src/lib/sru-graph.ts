import { escapeHtml } from './escape-html.mjs';
import {
  type Sru,
  sruSource,
  sruPage,
  sruRateLabel,
  sruRateValue,
} from './dossiers-territoriaux';
import { communeCode } from './communes.mjs';

export function sruPicture(name: string, code: string, row: Sru) {
  if (!communeCode.test(code)) throw Error('Code communal invalide');
  const value = sruRateValue(row.rate);
  const printed = sruRateLabel(row.rate);
  const title = 'Logement social · ' + name;
  const alt =
    title +
    ' (' +
    code +
    '). Inventaire au 1er janvier 2025 : ' +
    printed +
    '. Objectif indiqué : ' +
    row.target +
    ' %.';
  const end = value === null ? 100 : Math.max(100, Math.ceil(value / 25) * 25);
  const scale = (v: number) => 32 + (v / end) * 528;
  const marker = scale(row.target);
  const nameSize = Math.min(28, Math.floor(885 / Math.max(1, name.length)));
  const stock =
    row.inventory === null
      ? 'Nombre de logements non renseigné'
      : row.inventory.toLocaleString('fr-FR') +
        ' logements sociaux inventoriés';
  const chart =
    value === null
      ? ''
      : '<rect x="32" y="169" height="12" rx="5" width="' +
        (scale(value) - 32).toFixed(2) +
        '" fill="#2d838e"/>';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 320" width="600" height="320" role="img" aria-labelledby="t d"><title id="t">' +
    escapeHtml(title) +
    '</title><desc id="d">' +
    escapeHtml(alt) +
    '</desc><rect width="600" height="320" rx="14" fill="#eaf3f3"/><g font-family="system-ui,sans-serif" fill="#173847"><text x="32" y="36" fill="#3b6069" font-size="15">LOGEMENT SOCIAL · INSEE ' +
    code +
    '</text><text x="32" y="75" font-size="' +
    nameSize +
    '" font-weight="650">' +
    escapeHtml(name) +
    '</text><text x="32" y="116" font-size="25" font-weight="600">' +
    escapeHtml(printed) +
    '</text><text x="32" y="141" fill="#415d68" font-size="15">des résidences principales · inventaire 2025</text><rect x="32" y="169" height="12" width="528" rx="5" fill="#cbdddf"/>' +
    chart +
    '<path d="M' +
    marker +
    ' 158v34" stroke="#754321" stroke-width="3"/><text x="' +
    marker +
    '" y="215" text-anchor="middle" font-size="15">Objectif ' +
    row.target +
    ' %</text><text x="560" y="206" text-anchor="end" font-size="13">' +
    end +
    ' %</text><text x="32" y="257" font-size="18">' +
    escapeHtml(stock) +
    '</text><text x="32" y="290" font-size="15">Ministère du Logement · inventaire SRU · Polradar</text></g></svg>';
  return { svg, alt };
}
export function sruImageUrl(svg: string) {
  const bytes = new TextEncoder().encode(svg);
  return (
    'data:image/svg+xml;base64,' +
    btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
  );
}
export function sruEmbedCode(name: string, code: string, data: Sru) {
  const { svg, alt } = sruPicture(name, code, data);
  return (
    '<figure>\n  <img src="' +
    sruImageUrl(svg) +
    '" width="600" height="320" style="max-width:100%;height:auto" alt="' +
    escapeHtml(alt) +
    '">\n  <figcaption><a href="https://polradar.fr' +
    sruPage +
    '#commune=' +
    code +
    '" rel="noreferrer">Polradar · ' +
    escapeHtml(name) +
    '</a> · <a href="' +
    sruSource +
    '" rel="noreferrer">Inventaire du ministère du Logement</a></figcaption>\n</figure>'
  );
}
