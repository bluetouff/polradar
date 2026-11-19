import { ballotDots, positionLabel } from './legislative-votes.mjs';
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (s) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        s
      ],
  );
const e = escapeHtml;
const n = (v) => v.toLocaleString('fr-FR');
const label = (s) => `<span>${e(s)}</span>`;
const bars = (g) => {
  const max = Math.max(...g.rows.map((r) => r.value), 1);
  return `<div class="og-chart-heading">${e(g.unit)}</div><div class="og-bars${g.rows.length > 6 ? ' og-bars-dense' : ''}">${g.rows.map((r) => `<div class="og-bar-row"><div>${label(r.label)}<strong>${n(r.value)}</strong></div><svg class="og-bar-track" viewBox="0 0 400 5" preserveAspectRatio="none" aria-hidden="true"><rect width="${((r.value / max) * 400).toFixed(3)}" height="5" rx="2" /></svg></div>`).join('')}</div>`;
};
function graphic(g) {
  switch (g.kind) {
    case 'bars':
      return bars(g);
    case 'home':
      return `<div class="og-home-stats"><strong>${n(g.total)}<span>fiches actuelles</span></strong><div><b>${g.candidates}</b> candidatures<br /><b>${g.themes}</b> thèmes</div></div>${bars({ rows: g.rows, unit: 'Fiches par thème · sélection' })}`;
    case 'tiles':
      return `<div class="og-chart-heading">${e(g.label)}</div><div class="og-tiles">${g.rows.map((r) => `<div><strong>${e(r.value)}</strong>${label(r.label)}</div>`).join('')}</div>`;
    case 'people':
      return `<div class="og-people-total"><strong>${g.total}</strong><span>candidatures<br />recensées</span></div><div class="og-people">${g.names
        .map(
          (name) =>
            `<div><i>${e(
              name
                .split(/[\s-]+/)
                .map((s) => s[0])
                .slice(0, 2)
                .join(''),
            )}</i>${label(name)}</div>`,
        )
        .join('')}</div>`;
    case 'divergences':
      return `<div class="og-chart-heading">Âges de départ annoncés · ans</div><div class="og-divergences">${g.rows.map((r) => `<div>${label(r.label)}<strong>${r.value}<small>ans</small></strong></div>`).join('')}</div><p class="og-chart-note">Sélection du corpus · conditions dans les fiches</p>`;
    case 'timeline':
      return `<div class="og-chart-heading">${e(g.label)}</div><ol class="og-timeline">${g.rows.map((r) => `<li><b>${e(r.value)}</b><i></i><div><strong>${e(r.label)}</strong><small>${e(r.detail)}</small></div></li>`).join('')}</ol>`;
    case 'vote': {
      const b = g.ballot,
        c = ballotDots(b);
      return `<div class="og-chart-heading">${e(b.shortTitle)} · ${b.date.split('-').reverse().join('.')}</div><div class="og-vote"><svg viewBox="0 0 ${c.width} ${c.height}" aria-hidden="true">${c.dots.map((d) => `<circle cx="${d.x}" cy="${d.y}" r="3.1" class="dot-${d.choice}" />`).join('')}</svg><div class="og-vote-counts"><span><b>${b.tally.for}</b>pour</span><span><b>${b.tally.against}</b>contre</span><span><b>${b.tally.abstained}</b>abstentions</span></div></div><div class="og-vote-positions">${b.positions.map((p) => `<span>${e(p.officialName)} <b>${e(positionLabel(p, b))}</b></span>`).join('')}</div><p class="og-chart-note">Assemblée nationale · scrutin n°${b.number} · 1 point = 1 voix ou abstention</p>`;
    }
    case 'finance':
      return `<div class="og-chart-heading">David Lisnard · Nouvelle Énergie</div><div class="og-finance-total"><b>${g.total / 1e9}<small>Md€</small></b><span>d’économies annoncées<br />par an à terme</span></div><svg class="og-finance-strip" viewBox="0 0 400 39" preserveAspectRatio="none" aria-hidden="true">${g.rows.map((r, i) => `<rect class="allocation-${i}" x="${g.rows.slice(0, i).reduce((sum, a) => sum + (a.value / g.total) * 400, 0)}" y="0" width="${(r.value / g.total) * 400}" height="39" />`).join('')}</svg><div class="og-allocations">${g.rows.map((r, i) => `<div><i class="allocation-${i}"></i><b>${r.value / 1e9} Md€</b>${label(r.label)}</div>`).join('')}</div><p class="og-chart-note">Répartition publiée par le parti · montée en charge progressive</p>`;
    case 'map':
      return `<div class="og-chart-heading">Rendez-vous documentés · communes recensées</div><svg class="og-map" viewBox="0 0 520 510" aria-hidden="true"><path d="${e(g.path)}"/>${g.points.map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="5" />`).join('')}</svg><p class="og-chart-note">Fond Natural Earth · communes : geo.api.gouv.fr</p>`;
    case 'watch':
      return `<div class="og-watch-total"><strong>${g.total}</strong><span>documents dans<br />le dernier relevé intégré</span></div><div class="og-watch-grid">${g.states.map((s) => `<i class="state-${e(s)}"></i>`).join('')}</div><p class="og-chart-note">Relevé intégré : ${e(g.observed)} · collecte quotidienne<br />Les changements sont relus avant publication.</p>`;
    case 'document':
      return `<div class="og-document"><span class="og-document-code">POLRADAR / 2027</span>${g.rows.map((r, i) => `<div><b>${String(i + 1).padStart(2, '0')}</b>${label(r)}<i>↗</i></div>`).join('')}<span class="og-document-bottom">polradar.fr</span></div>`;
    default:
      throw Error('Graphique OG inconnu');
  }
}
export function socialImageHtml(card) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=1200"><link rel="stylesheet" href="/card.css"><title>${e(card.title)}</title></head><body class="palette-${e(card.palette)}"><article class="og-card"><header><span class="og-brand"><svg viewBox="0 0 208 48" role="img" aria-label="Polradar"><use href="/marque/polradar.svg#signature"/></svg></span><span class="og-election">PRÉSIDENTIELLE FRANÇAISE <b>2027</b></span></header><main><div class="og-intro"><p class="og-kicker">${e(card.kicker)}</p><h1>${card.title.split('\n').map(e).join('<br>')}</h1><p class="og-description">${e(card.description)}</p><span class="og-signature">l0g_<i> / </i>bluetouff</span></div><section class="og-graphic og-graphic-${e(card.graphic.kind)}">${graphic(card.graphic)}</section></main><footer><span>polradar.fr${card.path === '/' ? '' : e(card.path)}</span><span>Édition du ${card.edition.split('-').reverse().join('.')}</span><span class="og-footer-mark">●</span></footer></article></body></html>`;
}
