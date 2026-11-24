import { createHash } from 'node:crypto';
import {
  comparePollWaves,
  pollSignature,
  legacyPollSignature,
  pollSeries,
  rankedPollResults,
} from './features.mjs';
import migration from '../data/poll-graphic-migration.json' with { type: 'json' };
import { escapeHtml as esc } from './social-image-view.mjs';
import { isPublicSourceUrl } from './source-url.mjs';

const width = 560;
const number = new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 21 });
const date = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'UTC',
});
const civilDay = (value) => new Date(value + 'T12:00:00Z');

const digest = (text) => createHash('sha256').update(text).digest('hex');
const priorWaves = new Set(
  Object.values(migration).flatMap((entry) => entry.waves),
);

export function pollGraphicSeriesId(poll) {
  const scope = digest(pollSignature(poll));
  const old = digest(legacyPollSignature(poll));
  return 'serie-' + (migration[old]?.scope === scope ? old : scope);
}

/** When a historical scope splits, the old URL resolves to its last published observation. */
export function legacyPollGraphics(polls, current) {
  const active = new Set(current.map((group) => group.id));
  const byId = new Map(polls.map((row) => [row.id, row]));
  return Object.entries(migration)
    .filter(([key]) => !active.has('serie-' + key))
    .map(([key, entry]) => {
      const latest = byId.get(entry.waves.at(-1));
      if (!latest)
        throw new Error('Observation historique de sondage manquante');
      return { id: 'serie-' + key, latest };
    });
}
/** @param {import('./data').Poll[]} polls */
export function pollGraphicCatalog(polls) {
  return pollSeries(polls)
    .map((waves) => ({
      id: pollGraphicSeriesId(waves[0]),
      waves,
      latest: waves[waves.length - 1],
    }))
    .sort((a, b) => comparePollWaves(b.latest, a.latest));
}

// Retrospective tables are drawn in the survey reader. Published image URLs
// continue to follow only the original stream and later routine waves.
export function pollEmbeds(polls) {
  return pollGraphicCatalog(polls.filter((p) => !p.historicalImport));
}

function sourceLink(sources, id, page, label) {
  const source = sources.find((item) => item.id === id);
  if (
    !isPublicSourceUrl(source?.url) ||
    !Number.isSafeInteger(page) ||
    page < 1
  )
    throw new Error('Référence de sondage invalide : ' + id);
  const url = new URL(source.url);
  url.hash = 'page=' + page;
  return { label: label + ', p. ' + page, url: url.href };
}

// Keep wide glyphs and long unbroken labels inside the SVG without a browser font dependency.
function units(text) {
  let size = 0;
  for (const char of text.normalize('NFD').replace(/\p{M}/gu, '')) {
    if (/[iljI.,:;'’\s-]/u.test(char)) size += 0.34;
    else if (/[rft()/]/u.test(char)) size += 0.44;
    else if (/[MW@%]/u.test(char)) size += 1.03;
    else if (/[mw]/u.test(char)) size += 0.88;
    else if (/[a-z0-9]/u.test(char)) size += 0.61;
    else if (/[A-Z]/u.test(char)) size += 0.78;
    else size += 1.1;
  }
  return size;
}

function wrap(value, maxWidth, fontSize) {
  const limit = maxWidth / fontSize;
  const lines = [];
  let line = '';
  // Keep French narrow nonbreaking spaces inside numbers.
  for (const word of value.trim().split(/[ \t\r\n]+/u)) {
    if (line && units(line + ' ' + word) <= limit) {
      line += ' ' + word;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const char of word) {
      if (line && units(line + char) > limit) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textLines(lines, x, y, leading, attributes = '') {
  return `<text ${attributes}>${lines.map((line, i) => `<tspan x="${x}" y="${y + i * leading}">${esc(line)}</tspan>`).join('')}</text>`;
}

function scoreLabel(result) {
  if (result.below !== undefined)
    return 'Moins de ' + number.format(result.below) + ' %';
  return result.percentage === null
    ? 'Non publié'
    : number.format(result.percentage) + ' %';
}

/** @param {import('./data').Poll} poll @param {{id: string, url: string}[]} sourceRows */
export function pollGraphic(
  poll,
  sourceRows,
  documentQuestion = !priorWaves.has(poll.id),
) {
  const sources = [
    sourceLink(
      sourceRows,
      poll.noticeSource,
      poll.noticePage,
      'Commission des sondages',
    ),
  ];
  if (poll.resultSource)
    sources.push(
      sourceLink(
        sourceRows,
        poll.resultSource,
        poll.resultPage,
        poll.institute,
      ),
    );

  let provenance = '';
  if (documentQuestion) {
    const item = poll.question;
    if (item?.status === 'verifiee') {
      const reference = sourceLink(
        sourceRows,
        item.sourceId,
        item.page,
        'Question posée',
      );
      provenance =
        ' · ' +
        [
          item.wording,
          item.base,
          reference.url,
          'Vérification ' + item.checked,
          item.equivalence?.reason,
        ]
          .filter(Boolean)
          .map(esc)
          .join(' · ');
    } else {
      provenance =
        ' · Libellé original à vérifier. Comparabilité non confirmée.';
    }
  }
  const dateLabel = date.format(civilDay(poll.published));
  const terrain = date.formatRange(
    civilDay(poll.fieldworkStart),
    civilDay(poll.fieldworkEnd),
  );
  const scenario = poll.institute + ' · ' + poll.scenario;
  const title = 'Intentions de vote · ' + scenario;
  const results = rankedPollResults(poll);
  const facts = [
    [
      'Échantillon',
      `${number.format(poll.sampleSize)} personnes interrogées, dont ${number.format(poll.registeredSample)} inscrits.`,
    ],
    [
      'Effectif utile',
      poll.usefulSample === null
        ? 'Non précisé pour cette question.'
        : number.format(poll.usefulSample) + ' pour cette question.',
    ],
    ['Population', poll.population],
    ['Recueil', poll.method],
    ['Commanditaire', poll.commissioner],
  ];
  if (poll.noIntention !== null)
    facts.push([
      'Sans intention exprimée',
      [number.format(poll.noIntention) + ' %', poll.noIntentionNote]
        .filter(Boolean)
        .join(' · '),
    ]);
  facts.push(['Sources', sources.map((source) => source.label).join(' · ')]);

  const summary = results.map((r) => r.name + ', ' + scoreLabel(r)).join('. ');
  const alt = `${title}. Terrain : ${terrain}. Publication : ${dateLabel}. ${summary}.`;
  const desc = [
    alt,
    ...facts.map(([label, value]) => label + ' : ' + value),
    poll.uncertainty,
  ].join(' ');
  const scenarioLines = wrap(scenario, width - 54, 19);
  const headerHeight = 100 + 25 * scenarioLines.length;
  const fieldworkLines = wrap(terrain, 275, 18);
  const dateLines = wrap(dateLabel, 218, 18);
  const datesHeight =
    47 + 23 * Math.max(fieldworkLines.length, dateLines.length);
  const axisY = headerHeight + datesHeight + 29;
  const plotX = 231,
    plotWidth = 183;
  let y = axisY + 12;
  const bars = results
    .map((result) => {
      const names = wrap(result.name, plotX - 39, 18);
      const scores = wrap(
        scoreLabel(result),
        width - 24 - (plotX + plotWidth + 12),
        17,
      );
      const lines = Math.max(names.length, scores.length);
      const height = 19 + lines * 21;
      const center = y + height / 2;
      const baseline = (count) => center + 6 - ((count - 1) * 21) / 2;
      const bar =
        result.percentage === null
          ? ''
          : `<rect x="${plotX}" y="${center - 4}" width="${plotWidth}" height="8" rx="4" fill="#dbe8e9"/><rect x="${plotX}" y="${center - 4}" width="${(plotWidth * result.percentage) / 100}" height="8" rx="4" fill="#23737c"/>`;
      const row = `<g>${textLines(names, 24, baseline(names.length), 21, 'font-size="18"')}${bar}${textLines(scores, width - 24, baseline(scores.length), 21, 'text-anchor="end" font-size="17" font-weight="650"')}<path d="M24 ${y + height}H536" stroke="#d3e1e3"/></g>`;
      y += height;
      return row;
    })
    .join('');

  const notesTop = y + 14;
  y = notesTop + 28;
  const notes = facts
    .map(([label, value]) => {
      const headings = wrap(label, 132, 16);
      const words = wrap(value, 376, 16);
      const row =
        textLines(
          headings,
          24,
          y,
          21,
          'font-size="16" font-weight="650" fill="#245866"',
        ) + textLines(words, 160, y, 21, 'font-size="16"');
      y += Math.max(headings.length, words.length) * 21 + 11;
      return row;
    })
    .join('');
  const height = y + 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xml:lang="fr" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="titre description">
<title id="titre">${esc(title)}</title><desc id="description">${esc(desc)}</desc>
<metadata>${sources.map((s) => esc(s.label + ' : ' + s.url)).join(' · ')}${provenance}</metadata>
<defs><linearGradient id="entete" x2="1" y2="1"><stop stop-color="#102c40"/><stop offset="1" stop-color="#155360"/></linearGradient></defs>
<rect width="${width}" height="${height}" rx="14" fill="#f8fbfb"/>
<g font-family="Arial, Helvetica, sans-serif" fill="#173746" aria-hidden="true">
<path d="M14 0H546Q560 0 560 14V${headerHeight}H0V14Q0 0 14 0Z" fill="url(#entete)"/>
<g fill="none" stroke="#9ddcde" stroke-width="2" stroke-linecap="round"><circle cx="33" cy="28" r="9"/><path d="M33 28l10-10"/></g>
<text x="52" y="34" font-size="16" letter-spacing="1.4" fill="#d9f3f3">polradar</text><text x="536" y="34" text-anchor="end" font-size="15" fill="#d9f3f3">Présidentielle 2027</text>
<text x="24" y="74" font-size="30" font-weight="700" fill="#fff">Intentions de vote</text>
${textLines(scenarioLines, 24, 103, 25, 'font-size="19" fill="#e2f0f1"')}
<g font-size="14" font-weight="650" fill="#3e6270"><text x="24" y="${headerHeight + 24}">TERRAIN</text><text x="315" y="${headerHeight + 24}">PUBLICATION</text></g>
${textLines(fieldworkLines, 24, headerHeight + 49, 23, 'font-size="18"')}${textLines(dateLines, 315, headerHeight + 49, 23, 'font-size="18"')}
<path d="M24 ${headerHeight + datesHeight}H536" stroke="#a7c3c8"/>
<g font-size="14" fill="#3d5b67"><text x="24" y="${axisY}">Candidats testés</text><text x="${plotX}" y="${axisY}">0 %</text><text x="${plotX + plotWidth / 2}" y="${axisY}" text-anchor="middle">50 %</text><text x="${plotX + plotWidth}" y="${axisY}" text-anchor="end">100 %</text><text x="536" y="${axisY}" text-anchor="end">Résultat</text></g>
${bars}<path d="M0 ${notesTop}H560V${height - 14}Q560 ${height} 546 ${height}H14Q0 ${height} 0 ${height - 14}Z" fill="#e7f1f1"/>
${notes}</g></svg>`;
  return {
    svg,
    width,
    height,
    title,
    alt,
    dateLabel,
    sources,
    page: '/sondages/#enquete=' + encodeURIComponent(poll.id),
  };
}
