import { createHash } from 'node:crypto';
import { escapeHtml as esc } from './social-image-view.mjs';
import {
  retirementComparison,
  retirementUrl,
} from './retirement-comparison.mjs';

export const cardSize = { width: 480, height: 610 };
const dateFr = (day) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(day + 'T12:00:00Z'));
export const liveGraphicPath = (id) => '/graphiques/retraites/' + id + '.svg';
export const frozenGraphicPath = (svg) =>
  '/graphiques/retraites/editions/' +
  createHash('sha256').update(svg).digest('hex') +
  '.svg';

export function retirementCard(comparison, cohort, dataset) {
  const { panels, programmes } = retirementComparison(
    comparison,
    cohort,
    dataset,
  );
  const summary = panels
    .map(
      (p) =>
        p.label + '. ' + p.rows.map((r) => r.name + ', ' + r.text).join('. '),
    )
    .join('. ');
  const groups = panels
    .map((panel, index) => {
      const top = 102 + index * 148;
      const rows = panel.rows
        .map((row, i) => {
          const y = top + 56 + i * 28;
          const trackLeft = 210,
            trackWidth = 85;
          const dot =
            row.position === null
              ? ''
              : `<path d="M${trackLeft} ${y - 5}h${trackWidth}" stroke="#b3cbd1" stroke-width="2"/><circle cx="${(trackLeft + row.position * trackWidth).toFixed(2)}" cy="${y - 5}" r="4.5" fill="${i === 0 ? '#16394a' : '#15707c'}"/>`;
          return `${i === 0 ? `<rect x="14" y="${y - 19}" width="452" height="25" rx="4" fill="#e0eef0"/>` : ''}<text x="24" y="${y}" font-size="17">${esc(row.name)}</text>${dot}<text x="455" y="${y}" text-anchor="end" font-size="17" font-weight="${row.position === null ? '400' : '650'}" fill="${row.position === null ? '#49646d' : '#17394a'}">${esc(row.text)}</text>`;
        })
        .join('\n');
      return `<g><text x="24" y="${top + 14}" fill="#0c6372" font-size="20" font-weight="650">${esc(panel.label)}</text><g fill="#486572" font-size="13"><text x="210" y="${top + 32}" text-anchor="middle">${panel.ticks[0]}</text><text x="295" y="${top + 32}" text-anchor="middle">${panel.ticks.at(-1)} ${panel.id === 'duree' ? 'trim.' : 'ans'}</text></g>${rows}</g>`;
    })
    .join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="610" viewBox="0 0 480 610" role="img" aria-labelledby="titre description">
<title id="titre">Retraites · génération ${esc(cohort.label)}</title><desc id="description">${esc(summary)}. Droit et programmes consultés le ${esc(dateFr(comparison.reviewedOn))}.</desc>
<defs><linearGradient id="entete" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#122b3e"/><stop offset="1" stop-color="#155462"/></linearGradient></defs>
<rect width="480" height="610" rx="13" fill="#f4f9f9"/>
<g font-family="system-ui, sans-serif" fill="#183846"><path d="M13 0h454q13 0 13 13v80H0V13Q0 0 13 0" fill="url(#entete)"/>
<g fill="none" stroke="#89d6d7" stroke-width="2" stroke-linecap="round"><circle cx="36" cy="27" r="10"/><path d="M36 27l11-11"/></g>
<text x="55" y="32" fill="#d7eef0" font-size="16" letter-spacing="1.5">polradar</text>
<text x="24" y="71" fill="white" font-size="28" font-weight="650">Retraites</text><text x="455" y="69" text-anchor="end" fill="#d7eef0" font-size="17">${esc(cohort.label)}</text>
${groups}
<path d="M24 548h432" stroke="#a8c2c7"/><text x="24" y="572" font-size="16">Régime général · vérifié le ${esc(dateFr(comparison.reviewedOn))}</text>
<text x="24" y="596" font-size="14" fill="#425f6a">Légifrance · Assurance retraite · programmes des candidats</text></g></svg>`;
  return {
    svg,
    programmes,
    summary,
    date: dateFr(comparison.reviewedOn),
    page: retirementUrl(cohort.id),
  };
}

export function retirementSnippet({
  image,
  page,
  cohort,
  frozen,
  date,
  sources,
  summary,
}) {
  const text =
    'Retraites, génération ' +
    cohort +
    '. ' +
    (frozen
      ? summary + '. Édition du ' + date + '.'
      : 'Droit en vigueur et trois programmes. Tableau des valeurs et sources dans la légende.');
  const links = frozen
    ? sources
        .map(
          (s) => `<a href="${esc(s.url)}" rel="noreferrer">${esc(s.label)}</a>`,
        )
        .join(' · ')
    : '';
  return `<figure>
  <img src="${esc(image)}" alt="${esc(text)}" width="480" height="610" style="max-width:100%;height:auto" loading="lazy" decoding="async" referrerpolicy="no-referrer">
  <figcaption><a href="${esc(page)}#retirement-graph" rel="noreferrer">Polradar · tableau des valeurs</a> · <a href="${esc(page)}#retirement-references" rel="noreferrer">Sources</a>${frozen ? ' · Édition du ' + esc(date) + '<br>' + links : ''}</figcaption>
</figure>`;
}
