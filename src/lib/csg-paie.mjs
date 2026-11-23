import { escapeHtml } from './escape-html.mjs';

export const salaryLaw =
  'https://www.service-public.gouv.fr/particuliers/vosdroits/F2971?quest6=0';
export const salaryPage = '/questions/fiscalite-csg-salaires/';
export const salaryImage = '/graphiques/csg.svg';
export const euro = (cents) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

// One ordinary monthly salary, paid identically twelve times, expressed in cents.
export function csgExample(gross) {
  if (!Number.isSafeInteger(gross) || gross < 0 || gross * 12 > 19224000)
    throw RangeError('Hors du cas de paie décrit');
  const base = Math.floor((gross * 9825 + 5000) / 10000);
  const deducted = Math.floor((base * 68 + 500) / 1000);
  const other = Math.floor((base * 24 + 500) / 1000);
  return { gross, base, deducted, other, total: deducted + other };
}
export const payrolls = [200000, 300000, 400000].map(csgExample);
export function salaryGraphic() {
  const width = 600,
    height = 378;
  const title = 'La CSG sur trois salaires bruts';
  const alt =
    'CSG mensuelle sur un salaire ordinaire en 2026. ' +
    payrolls
      .map((p) => euro(p.gross) + ' bruts : ' + euro(p.total))
      .join(' ; ') +
    '.';
  const max = payrolls.at(-1).total;
  const rows = payrolls
    .map((p, i) => {
      const y = 118 + i * 58,
        w = (p.total / max) * 256,
        d = (p.deducted / max) * 256;
      return (
        '<text x="28" y="' +
        y +
        '" fill="#183241" font-size="21">' +
        euro(p.gross) +
        '</text><rect x="171" y="' +
        (y - 15) +
        '" width="' +
        w.toFixed(2) +
        '" height="16" rx="2" fill="#b46538"/><rect x="171" y="' +
        (y - 15) +
        '" width="' +
        d.toFixed(2) +
        '" height="16" rx="2" fill="#21777f"/><text x="565" y="' +
        y +
        '" text-anchor="end" font-size="21" fill="#123943">' +
        euro(p.total) +
        '</text>'
      );
    })
    .join('');
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 378" width="600" height="378" role="img" aria-labelledby="title desc"><title id="title">' +
    title +
    '</title><desc id="desc">' +
    escapeHtml(alt) +
    '</desc><rect width="600" height="378" rx="16" fill="#edf4f3"/><g font-family="system-ui,sans-serif"><text x="28" y="42" font-size="26" font-weight="600" fill="#123541">' +
    title +
    '</text><g fill="#405968" font-size="15"><text x="28" y="78">Brut mensuel</text><text x="565" y="78" text-anchor="end">CSG prélevée</text></g>' +
    rows +
    '<rect x="28" y="266" width="13" height="13" fill="#21777f"/><text x="48" y="278" font-size="15">Déductible du revenu imposable</text><rect x="350" y="266" width="13" height="13" fill="#b46538"/><text x="370" y="278" font-size="15">Non déductible</text><path d="M28 300H572" stroke="#b9cdcd"/><g fill="#354f5c" font-size="15"><text x="28" y="327">CSG de 9,2 % sur 98,25 % du brut. Hors CRDS et compléments.</text><text x="28" y="354">Source : Service Public · règles 2026 · Polradar, 23 novembre 2026.</text></g></g></svg>';
  return {
    svg,
    width,
    height,
    title,
    alt,
    dateLabel: '23 novembre 2026',
    sources: [
      { label: 'Service Public · CSG sur les salaires', url: salaryLaw },
    ],
    page: salaryPage,
  };
}
