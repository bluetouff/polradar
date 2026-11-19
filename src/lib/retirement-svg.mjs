import { escapeHtml as esc } from './social-image-view.mjs';

const ink = '#173746';
const small = 'font-size="13" fill="#526369"';
const marks = ['#173746', '#9f4936', '#205d79', '#5e6642'];

export function retirementSvg(cohort, panels, programmes, url, reviewed) {
  const summary = panels
    .map(
      ({ label, rows }) =>
        `${label} : ${rows.map(({ name, text }) => `${name}, ${text}`).join('. ')}`,
    )
    .join('. ');
  const charts = panels
    .map((panel, index) => {
      const start = 34 + index * 408;
      const end = start + 378;
      const left = start + 20;
      const width = 338;
      const grids = panel.marks
        .map(({ value, position }) => {
          const x = left + position * width;
          const align =
            position === 0 ? 'start' : position === 1 ? 'end' : 'middle';
          return `<path d="M${x} 278 V560" stroke="#d5dcd6"/><text x="${x}" y="269" text-anchor="${align}" ${small}>${value}</text>`;
        })
        .join('');
      const rows = panel.rows
        .map(({ name, text, position }, row) => {
          const y = 322 + 70 * row;
          const value = esc(text);
          const sign =
            position === null
              ? ''
              : `<path d="M${left} ${y + 17} H${left + width}" stroke="#aebcb8"/><circle cx="${left + position * width}" cy="${y + 17}" r="7" fill="${marks[row]}" stroke="#fffdf8" stroke-width="2"/>`;
          const law =
            row === 0
              ? `<rect x="${left - 8}" y="${y - 24}" width="${width + 16}" height="53" rx="4" fill="#e7eeea"/>`
              : '';
          return `${law}<text x="${left}" y="${y}" font-weight="${row === 0 ? 750 : 550}">${esc(name)}</text><text x="${end - 20}" y="${y}" text-anchor="end" font-weight="${position === null ? 500 : 750}" ${position === null ? small : `fill="${marks[row]}"`}>${value}</text>${sign}`;
        })
        .join('');
      return `<g>
      <rect x="${start}" y="177" width="394" height="407" rx="10" fill="#fffdf8" stroke="#d5dcd6"/>
      <text x="${left}" y="215" font-weight="750" font-size="19">${esc(panel.label)}</text>
      <text x="${left}" y="239" ${small}>${esc(panel.detail)}</text>
      ${grids}${rows}
    </g>`;
    })
    .join('');
  const notes = programmes
    .map(
      ({ name, note }, index) =>
        `<text x="34" y="${610 + 23 * index}" ${small}><tspan font-weight="700">${esc(name)}</tspan> · ${esc(note)}</text>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="785" viewBox="0 0 1280 785" role="img" aria-labelledby="title desc">
  <title id="title">Ce qui changerait · Retraites · ${esc(cohort.label)}</title>
  <desc id="desc">${esc(summary)}</desc>
  <rect width="1280" height="785" fill="#f1eee5"/>
  <path d="M34 144 H1244" stroke="${ink}" stroke-width="2"/>
  <g fill="${ink}" font-size="15" font-family="system-ui, sans-serif">
    <text x="34" y="48" font-weight="750" letter-spacing="2">POLRADAR</text>
    <text x="1244" y="48" text-anchor="end" ${small}>Présidentielle 2027 · ${esc(reviewed)}</text>
    <text x="34" y="100" font-weight="760" font-size="37">Retraites · Ce qui changerait</text>
    <text x="34" y="127">Naissance · ${esc(cohort.label)}  /  Régime général, cas général, pensions prenant effet depuis le 1er septembre 2026</text>
    ${charts}
    ${notes}
    <text x="34" y="688" ${small}>Une annuité est placée à quatre trimestres sur l’axe de durée. Le taux plein évite la décote, le montant peut rester proratisé.</text>
    <text x="34" y="716" ${small}>Code de la sécurité sociale (art. L. 161-17-2, L. 161-17-3 et L. 351-8) et programmes officiels des trois candidats.</text>
    <text x="34" y="755" font-weight="700">${esc(url)}</text>
  </g>
</svg>`;
}
