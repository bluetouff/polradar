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

// Four monthly social-security ceilings for one ordinary salary paid twelve times.
const monthlyAbatementLimit = 4 * 4005 * 100;
export function monthlyCsg2026(gross) {
  if (
    !Number.isSafeInteger(gross) ||
    gross < 0 ||
    gross > Math.floor((Number.MAX_SAFE_INTEGER - 500) / 68)
  )
    throw RangeError('Salaire hors plage de calcul');
  const capped = Math.min(gross, monthlyAbatementLimit);
  const base = Math.floor((capped * 9825 + 5000) / 10000) + (gross - capped);
  const deducted = Math.floor((base * 68 + 500) / 1000);
  const other = Math.floor((base * 24 + 500) / 1000);
  return { gross, base, deducted, other, total: deducted + other };
}
export function csgExample(gross) {
  if (gross > monthlyAbatementLimit)
    throw RangeError('Hors du cas de paie décrit');
  return monthlyCsg2026(gross);
}

export function salaryCents(input) {
  if (typeof input !== 'string' || input.length > 24) return null;
  const match =
    /^(0|[1-9]\d*|[1-9]\d{0,2}(?:[ \u00a0\u202f]\d{3})+)(?:[,.](\d{1,2}))?$/u.exec(
      input.trim(),
    );
  if (!match) return null;
  const amount =
    Number(match[1].replace(/[ \u00a0\u202f]/gu, '')) * 100 +
    Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(amount) &&
    amount <= Math.floor((Number.MAX_SAFE_INTEGER - 500) / 68)
    ? amount
    : null;
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
