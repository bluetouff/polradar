import {
  decimalDifference,
  economyCurve,
  frequencyLabels,
  labelPeriod,
} from './economy.mjs';
import { wrapLabel } from './proposal-view.mjs';
import { escapeHtml as esc } from './social-image-view.mjs';

const width = 600;
const right = width - 28;
const plotHeight = 142;
const timeZone = 'Europe/Paris';
const day = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone });
const hour = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short', timeZone });
const flagLabels = {
  b: 'rupture de série',
  d: 'définition différente',
  e: 'estimation',
  f: 'prévision',
  p: 'provisoire',
  u: 'fiabilité limitée',
};

// The source decimals can be more precise than a JavaScript Number.
function formatDecimal(value) {
  const digits = value.split('.')[1]?.length ?? 0;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function flagLabel(flag) {
  if (!flag) return '';
  return [...flag.replaceAll(' ', '')]
    .map((code) => flagLabels[code] ?? `statut Eurostat ${code}`)
    .join(', ');
}

function linesAt(lines, top, step, options = '') {
  return lines
    .map(
      (line, i) =>
        `<text x="28" y="${top + i * step}" ${options}>${esc(line)}</text>`,
    )
    .join('\n');
}

function plot(series, chart, top) {
  const points = chart.segments.flat();
  let low = points[0].value;
  let high = low;
  for (const { value } of points) {
    if (Number(decimalDifference(value, low)) < 0) low = value;
    if (Number(decimalDifference(value, high)) > 0) high = value;
  }
  const span = Number(decimalDifference(high, low));
  const bottom = top + plotHeight;
  const y = (value) =>
    span
      ? top + plotHeight * (Number(decimalDifference(high, value)) / span)
      : top + plotHeight / 2;
  const ticks = span ? [high, low] : [high];
  if (Number(low) < 0 && Number(high) > 0) ticks.push('0');
  const left = Math.max(
    56,
    30 + Math.max(...ticks.map((v) => formatDecimal(v).length)) * 10,
  );
  const single = series.observations.length === 1;
  const x = (position) => left + (single ? 0.5 : position) * (right - left);
  const grid = ticks
    .map((value) => {
      const baseline = Number(value) === 0;
      const pos = y(value).toFixed(2);
      const showLabel =
        baseline || ticks.length < 3 || Math.abs(y(value) - y('0')) >= 18;
      return `<path d="M${left} ${pos}H${right}" stroke="${baseline ? '#62838c' : '#c2d4d7'}" ${baseline ? 'stroke-width="1.5"' : 'stroke-dasharray="3 4"'}/>${showLabel ? `<text x="${left - 10}" y="${(+pos + 5).toFixed(2)}" text-anchor="end">${esc(formatDecimal(value))}</text>` : ''}`;
    })
    .join('');

  // Separate absent periods as well as Eurostat's flagged breaks in series.
  const ranges = [];
  const parts = [];
  const breaks = [];
  let lastX = 0;
  for (const segment of chart.segments) {
    if (segment[0].x > lastX) ranges.push([lastX, segment[0].x]);
    let part = [];
    for (const point of segment) {
      if (point.flag.includes('b')) {
        breaks.push(point);
        if (part.length) parts.push(part);
        part = [];
      }
      part.push(point);
    }
    parts.push(part);
    lastX = segment.at(-1).x;
  }
  if (!single && lastX < 1) ranges.push([lastX, 1]);
  const gaps = ranges
    .map(
      ([a, b]) =>
        `<rect x="${x(a).toFixed(2)}" y="${top}" width="${(x(b) - x(a)).toFixed(2)}" height="${plotHeight}" fill="url(#lacune)"/>`,
    )
    .join('');
  const cuts = breaks
    .map(
      (point) =>
        `<path d="M${x(point.x).toFixed(2)} ${top}v${plotHeight}" stroke="#8b5a34" stroke-dasharray="3 4"/>`,
    )
    .join('');
  const dot = (point, radius) =>
    `<circle cx="${x(point.x).toFixed(2)}" cy="${y(point.value).toFixed(2)}" r="${radius}" fill="#106b77" stroke="#fff" stroke-width="1.5"/>`;
  const curves = parts
    .map((part) =>
      part.length === 1
        ? dot(part[0], 4)
        : `<polyline points="${part.map((p) => `${x(p.x).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ')}" fill="none" stroke="#106b77" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    )
    .join('');
  const periodTick = (norm, period, anchor) =>
    `<text x="${x(norm).toFixed(2)}" y="${bottom + 24}" text-anchor="${anchor}">${esc(labelPeriod(period))}</text>`;
  const dates = [
    periodTick(0, series.observations[0][0], single ? 'middle' : 'start'),
  ];
  if (!single) {
    const mid = points.reduce((nearest, p) =>
      Math.abs(0.5 - p.x) < Math.abs(0.5 - nearest.x) ? p : nearest,
    );
    if (mid.x > 0.35 && mid.x < 0.65)
      dates.push(periodTick(mid.x, mid.period, 'middle'));
    dates.push(periodTick(1, series.observations.at(-1)[0], 'end'));
  }
  const notes = [];
  if (ranges.length) notes.push('Hachures · périodes sans observation');
  if (breaks.length)
    notes.push('Pointillés verticaux · rupture de série Eurostat');
  return {
    graphic: `<g font-size="15" fill="#385b68">${gaps}${grid}${cuts}${curves}${dot(chart.latest, 5.5)}${dates.join('')}</g>`,
    notes,
  };
}

/** Render one of the enriched Eurostat series from economy-data. */
export function economyGraphic(economy, id) {
  const series = economy.find((row) => row.id === id);
  if (!series) throw new Error('Indicateur économique inconnu');
  const { title, description, observations, frequency, unit } = series;
  const page = `/economie/${encodeURIComponent(series.id)}/`;
  const sources = [
    { label: 'Table Eurostat', url: series.links.table },
    { label: 'Extraction Eurostat pour la France', url: series.links.api },
  ];
  const updated = new Date(series.updatedAt);
  const dateLabel = day.format(updated);
  const sourceDate = `Jeu de données mis à jour le ${dateLabel} à ${hour.format(updated)} (Paris).`;
  const titles = wrapLabel(title, 34);
  const details = wrapLabel(description, 57);
  const headerHeight = 88 + (titles.length - 1) * 32;
  const detailTop = headerHeight + 28;
  const readingTop = detailTop + (details.length - 1) * 22 + 34;
  const chart = economyCurve(observations, frequency, 1, 1, 0);
  const latest = chart?.latest;
  let reading = 'Donnée indisponible';
  let label = 'Aucune observation chiffrée dans ce relevé.';
  let graphic = '';
  let footerTop = readingTop + 70;
  let alt = `${title}. France. ${description} ${label}`;
  if (latest) {
    reading = `${formatDecimal(latest.value)} ${unit}`;
    const status = flagLabel(latest.flag);
    label = `Dernière valeur · ${labelPeriod(latest.period)}${status ? ` · ${status}` : ''}`;
    const labelLines = wrapLabel(label, 57);
    const axisTop = readingTop + 60 + (labelLines.length - 1) * 22;
    const chartTop = axisTop + 20;
    const { graphic: curve, notes } = plot(series, chart, chartTop);
    const finalPeriod = observations.at(-1)[0];
    if (latest.period !== finalPeriod)
      notes.push(
        `Dernière période du relevé · ${labelPeriod(finalPeriod)} indisponible`,
      );
    const notesTop = chartTop + plotHeight + 50;
    graphic = `${linesAt(labelLines, readingTop + 23, 22, 'font-size="17" fill="#385b68"')}<text x="28" y="${axisTop}" font-size="16" font-weight="650">Évolution en ${esc(unit)}</text>${curve}${linesAt(notes, notesTop, 21, 'font-size="15" fill="#385b68"')}`;
    footerTop = notesTop + (notes.length ? (notes.length - 1) * 21 + 18 : -6);
    const first = chart.segments[0][0];
    const history =
      first.period === latest.period
        ? ''
        : ` La série débute à ${formatDecimal(first.value)} ${unit} (${labelPeriod(first.period)}).`;
    alt = `${title}. France. ${description}${history} ${label}, ${reading}.`;
    if (notes.length) alt += ` ${notes.join('. ')}.`;
  } else {
    graphic = linesAt(
      [label],
      readingTop + 25,
      22,
      'font-size="17" fill="#385b68"',
    );
  }
  alt += ` Eurostat. ${sourceDate}`;
  const height = footerTop + 71;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="titre description" xml:lang="fr">
<title id="titre">${esc(title)} · France</title><desc id="description">${esc(alt)}</desc><metadata>Eurostat · ${esc(series.dataset)} · ${esc(series.updatedAt)}</metadata>
<metadata>${sources.map(({ label, url }) => esc(label + ' : ' + url)).join(' · ')}</metadata>
<defs><linearGradient id="entete" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#122b3e"/><stop offset="1" stop-color="#155462"/></linearGradient><pattern id="lacune" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M-1 1l2-2M0 7l7-7M6 8l2-2" stroke="#c1d2d4"/></pattern></defs>
<rect width="${width}" height="${height}" rx="13" fill="#f4f9f9"/>
<g font-family="system-ui, sans-serif" fill="#183846"><path d="M13 0h574q13 0 13 13v${headerHeight - 13}H0V13Q0 0 13 0" fill="url(#entete)"/>
<g fill="none" stroke="#89d6d7" stroke-width="2" stroke-linecap="round"><circle cx="38" cy="26" r="9"/><path d="M38 26l11-11"/></g><g fill="#d7eef0" font-size="16"><text x="56" y="32" letter-spacing="1.5">polradar</text><text x="${right}" y="32" text-anchor="end">France · ${esc(frequencyLabels[frequency])}</text></g>
${linesAt(titles, 69, 32, 'font-size="27" font-weight="650" fill="#fff"')}
${linesAt(details, detailTop, 22, 'font-size="17" fill="#385b68"')}
<text x="28" y="${readingTop}" font-size="${reading.length > 21 ? 27 : 32}" font-weight="700" fill="#0e6170">${esc(reading)}</text>${graphic}
<path d="M28 ${footerTop}H${right}" stroke="#aac2c7"/><text x="28" y="${footerTop + 26}" font-size="17" font-weight="650">Eurostat · ${esc(series.dataset)}</text><text x="28" y="${footerTop + 52}" font-size="15" fill="#385b68">${esc(sourceDate)}</text></g></svg>`;
  return { svg, width, height, title, alt, dateLabel, sources, page };
}
