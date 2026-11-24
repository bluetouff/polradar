import { ballotDots } from './legislative-votes.mjs';
import { escapeHtml } from './escape-html.mjs';
export { escapeHtml };

const e = escapeHtml;
const n = (value) => value.toLocaleString('fr-FR');
const heading = (text) => `<p class="og-chart-heading">${e(text)}</p>`;
const note = (text) => `<p class="og-chart-note">${e(text)}</p>`;
const logo =
  '<svg viewBox="0 0 208 48" role="img" aria-label="Polradar"><use href="/marque/polradar.svg#signature"/></svg>';

function bars(g) {
  // A social preview is a selection. Keep the source order and scale all marks from zero.
  const rows = g.rows.slice(0, 4);
  const max = Math.max(1, ...g.rows.map((row) => row.value));
  return (
    heading(g.unit + (rows.length < g.rows.length ? ' · sélection' : '')) +
    `<div class="og-bars">${rows.map((row) => `<div class="og-bar-row"><div><span>${e(row.label)}</span><b>${n(row.value)}</b></div><svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><rect x="0" width="${((100 * row.value) / max).toFixed(3)}" height="6"/></svg></div>`).join('')}</div>`
  );
}

// Small, purpose-drawn line illustrations for sections without numerical data.
const illustrations = {
  questions: [
    'M9 14h42v29H32l-11 9v-9H9z',
    'M24 24c2-6 11-6 12 0 0 5-7 4-7 9m0 4v1',
  ],
  'argent-des-campagnes': [
    'M9 20l35-9v9m-37 0h43a4 4 0 0 1 4 4v26H7z',
    'M55 29H41a6 6 0 0 0 0 12h14m-13-6h2',
  ],
  breves: [
    'M7 16h41v34H12c-3 0-5-2-5-5zm41 5h8v24c0 3-2 5-5 5',
    'M14 23h24m-24 7h11v10H14zm17 0h10m-10 6h10',
  ],
  'mises-a-jour': [
    'M10 28a22 22 0 0 1 35-15l6 5m0-9v10h-10M53 36a22 22 0 0 1-35 15l-6-5m0 9V45h10',
    'm22 32 7 7 14-15',
  ],
  methode: [
    'M13 10h30l8 9v34H13zM42 10v11h9',
    'm21 31 3 3 5-6m5 4h9m-22 9 3 3 5-6m5 4h9',
  ],
  reperes: [
    'M8 15h47v38H8zM8 26h47m-36-16v10m24-10v10',
    'M17 34h5m8 0h5m9 0h4m-31 9h5m9 0 4 4 8-9',
  ],
  'finances-publiques': [
    'm6 24 26-14 26 14zm3 28h46M14 45V30m12 15V30m12 15V30m12 15V30',
    'M11 46h42m-23-27h4',
  ],
  mcp: ['M7 15h50v36H7zM7 24h50', 'm17 31 7 6-7 6m12 0h10m-27-24h1m4 0h1'],
  'mcp-statistiques': [
    'M9 15v37h47m-42-10h36',
    'M18 41v-9h7v9m5 0V24h7v17m5 0V14h7v27',
  ],
  mentions: [
    'M14 10h32l6 7v36H14zM44 10v10h8',
    'M26 34v-3a6 6 0 0 1 12 0v3m-14 0h16v12H24zm8 5v3',
  ],
  'credits-photos': [
    'M7 22h11l4-7h18l5 7h12v28H7z',
    'M42 35a10 10 0 1 1-20 0 10 10 0 0 1 20 0Zm6-7h4',
  ],
};

function graphic(g, id) {
  switch (g.kind) {
    case 'bars':
      return bars(g);
    case 'tiles':
      return (
        heading(g.label) +
        `<dl class="og-tiles og-tiles-${g.rows.length}">${g.rows.map((r) => `<div><dt>${e(r.label)}</dt><dd>${e(r.value)}</dd></div>`).join('')}</dl>`
      );
    case 'people': {
      const amount = g.total;
      const columns = 11;
      const marks =
        amount > 0 && amount <= 77
          ? `<svg class="og-people" viewBox="0 0 464 ${Math.ceil(amount / columns) * 30}" aria-hidden="true">${Array.from({ length: amount }, (_, i) => `<g transform="translate(${(i % columns) * 42 + 2} ${Math.floor(i / columns) * 30})"><circle cx="8" cy="6" r="4"/><path d="M1 22v-4a7 7 0 0 1 14 0v4"/></g>`).join('')}</svg>`
          : '';
      return `<p class="og-candidate-count"><strong>${n(amount)}</strong><span>candidatures<br>recensées</span></p>${marks}`;
    }
    case 'divergences':
      return (
        heading('Âges de départ annoncés · sélection du corpus') +
        `<div class="og-figures">${g.rows.map((r) => `<p><span>${e(r.label)}</span><b>${n(r.value)} ans</b></p>`).join('')}</div>`
      );
    case 'party-plane': {
      const x = (v) => 30 + 38 * v;
      const y = (v) => 220 - 18.5 * v;
      return (
        heading('Économie et valeurs de société · CHES 2024') +
        `<svg class="og-plane" viewBox="0 0 440 253" aria-hidden="true"><g class="og-gridlines">${[0, 2.5, 5, 7.5, 10].map((i) => `<path d="M${x(i)} 35V220M30 ${y(i)}H410"/>`).join('')}</g>${g.parties.map((p) => `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="4.7"/><text x="${x(p.x)}" y="${y(p.y) + (p.name === 'RE' ? 19 : -10)}" text-anchor="middle">${e(p.name)}</text>`).join('')}<text class="og-axis" x="30" y="248">Gauche économique</text><text class="og-axis" x="410" y="248" text-anchor="end">Droite économique</text></svg>`
      );
    }
    case 'timeline':
      return (
        heading(g.label) +
        `<ol class="og-timeline">${g.rows.map((r) => `<li><strong>${e(r.value)}</strong><span>${e(r.label)}${id === 'evolution' ? `<small>${e(r.detail)}</small>` : ''}</span></li>`).join('')}</ol>`
      );
    case 'vote': {
      const b = g.ballot,
        chart = ballotDots(b);
      return (
        heading(b.shortTitle) +
        `<svg class="og-vote-dots" viewBox="0 0 ${chart.width} ${chart.height}" aria-hidden="true">${chart.dots.map((dot) => `<circle class="dot-${e(dot.choice)}" cx="${dot.x}" cy="${dot.y}" r="3.1"/>`).join('')}</svg><div class="og-vote-counts">${[
          ['pour', b.tally.for, 'Pour'],
          ['contre', b.tally.against, 'Contre'],
          ['abstention', b.tally.abstained, 'Abstentions'],
        ]
          .map(
            ([key, v, label]) =>
              `<div><b class="ink-${key}">${n(v)}</b><span>${label}</span></div>`,
          )
          .join('')}</div>` +
        note(
          `Assemblée nationale · scrutin n° ${b.number} · ${b.date.split('-').reverse().join('.')}`,
        )
      );
    }
    case 'finance': {
      let offset = 0;
      return (
        heading('David Lisnard · Nouvelle Énergie') +
        `<div class="og-finance-total"><strong>${n(g.total / 1e9)} <small>Md€</small></strong><span>d’économies annoncées<br>par an à terme</span></div><svg class="og-finance-strip" viewBox="0 0 400 16" preserveAspectRatio="none" aria-hidden="true">${g.rows
          .map((r, i) => {
            const start = offset;
            offset += (400 * r.value) / g.total;
            return `<rect class="allocation-${i}" x="${start}" y="0" width="${offset - start}" height="16"/>`;
          })
          .join(
            '',
          )}</svg><div class="og-allocations">${g.rows.map((r, i) => `<div><i class="allocation-${i}"></i><b>${n(r.value / 1e9)} Md€</b><span>${e(r.label)}</span></div>`).join('')}</div>`
      );
    }
    case 'map':
      return (
        `<svg class="og-map" viewBox="0 0 520 510" aria-hidden="true"><path d="${e(g.path)}"/>${g.points.map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="5.8"/>`).join('')}</svg>` +
        note('Rendez-vous documentés · fond Natural Earth')
      );
    case 'document': {
      const [outline, detail] = illustrations[id] ?? illustrations.methode;
      return `<div class="og-document"><svg class="og-document-sign" viewBox="0 0 64 64" aria-hidden="true"><path class="og-sign-outline" d="${outline}"/><path class="og-sign-detail" d="${detail}"/></svg><ul>${g.rows
        .slice(0, 3)
        .map((item) => `<li>${e(item)}</li>`)
        .join('')}</ul></div>`;
    }
    default:
      throw Error('Graphique OG inconnu');
  }
}

export function socialImageHtml(card) {
  const home = card.graphic.kind === 'home';
  const title = card.title
    .split('\n')
    .map((line) => `<span>${e(line)}</span>`)
    .join('');
  const figure = home
    ? ''
    : `<section class="og-graphic og-graphic-${e(card.graphic.kind)}">${graphic(card.graphic, card.id)}</section>`;
  const footer = home
    ? `<span>${n(card.graphic.candidates)} candidatures <i>·</i> ${n(card.graphic.themes)} thèmes</span>`
    : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=1200"><link rel="stylesheet" href="/card.css"><title>${e(card.title)}</title></head><body class="palette-${e(card.palette)}${home ? ' og-home' : ''}"><article class="og-card"><header><span class="og-brand">${logo}</span>${home ? '' : '<span class="og-election">PRÉSIDENTIELLE <b>2027</b></span>'}</header><main><div class="og-intro">${home ? '' : `<p class="og-kicker">${e(card.kicker)}</p>`}<h1>${title}</h1><p class="og-description">${e(card.description)}</p></div>${figure}</main><footer><span class="og-domain">polradar.fr</span>${footer}</footer></article></body></html>`;
}
