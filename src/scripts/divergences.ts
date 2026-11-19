import { divergenceLayout, formatMetricValue } from '../lib/divergences.mjs';
import { svg } from './ui';
const panels = [
  ...document.querySelectorAll<HTMLElement>('[data-divergence-panel]'),
];
const panelById = new Map(panels.map((panel) => [panel.id, panel]));
const controls = document.querySelector<HTMLElement>(
  '[data-divergence-controls]',
);
const select = document.querySelector<HTMLSelectElement>(
  '[data-divergence-select]',
);
const index = document.querySelector<HTMLElement>('[data-divergence-index]');
const status = document.querySelector<HTMLElement>('[data-divergence-status]');
const widths = new WeakMap<SVGSVGElement, number>();
function draw(panel: HTMLElement) {
  const chart = panel.querySelector<SVGSVGElement>('.divergence-svg');
  if (!chart) return;
  const width = Math.floor(chart.getBoundingClientRect().width);
  if (width < 180 || widths.get(chart) === width) return;
  const points = [
    ...chart.querySelectorAll<SVGGElement>('[data-divergence-point]'),
  ];
  const values = points.map((point) => ({
    value: Number(point.dataset.value),
  }));
  let layout;
  try {
    layout = divergenceLayout(values, width);
  } catch {
    chart.setAttribute('hidden', '');
    return;
  }
  widths.set(chart, width);
  chart.setAttribute('width', String(width));
  chart.setAttribute('height', String(layout.height));
  chart.setAttribute('viewBox', `0 0 ${width} ${layout.height}`);
  const axis = chart.querySelector<SVGLineElement>('[data-axis-line]')!;
  axis.setAttribute('x2', String(width - 38));
  axis.setAttribute('y1', String(layout.axisY));
  axis.setAttribute('y2', String(layout.axisY));
  const ticks = chart.querySelector<SVGGElement>('[data-axis-ticks]')!;
  ticks.replaceChildren(
    ...layout.ticks.map((tick, index) => {
      const group = svg('g');
      group.append(
        svg('line', {
          x1: String(tick.x),
          x2: String(tick.x),
          y1: String(layout.axisY - 4),
          y2: String(layout.axisY + 5),
        }),
        svg(
          'text',
          {
            x: String(tick.x),
            y: String(layout.axisY + 25),
            'text-anchor':
              index === 0
                ? 'start'
                : index === layout.ticks.length - 1
                  ? 'end'
                  : 'middle',
          },
          formatMetricValue(tick.value),
        ),
      );
      return group;
    }),
  );
  for (const point of layout.points) {
    const node = points[point.index],
      x = String(point.x),
      y = String(point.y);
    const halo = node.querySelector<SVGCircleElement>('[data-halo]')!;
    halo.setAttribute('cx', x);
    halo.setAttribute('cy', y);
    const leader = node.querySelector<SVGLineElement>('[data-leader]')!;
    leader.setAttribute('x1', x);
    leader.setAttribute('x2', x);
    leader.setAttribute('y1', String(point.y + 54));
    leader.setAttribute('y2', String(layout.axisY));
    const face = node.querySelector<SVGSVGElement>('[data-face]');
    if (face) {
      face.setAttribute('x', String(point.x - 25));
      face.setAttribute('y', String(point.y - 25));
    }
    const initials = node.querySelector<SVGTextElement>('[data-initials]');
    if (initials) {
      initials.setAttribute('x', x);
      initials.setAttribute('y', String(point.y + 4));
    }
    const value = node.querySelector<SVGTextElement>('[data-point-value]')!;
    value.setAttribute('x', x);
    value.setAttribute('y', String(point.y + 46));
  }
}
function activate(id: string, write = true) {
  const chosen = panelById.has(id) ? id : panels[0]?.id;
  if (!chosen) return;
  for (const panel of panels) panel.hidden = panel.id !== chosen;
  if (select) select.value = chosen;
  if (status) status.textContent = '';
  draw(panelById.get(chosen)!);
  if (write)
    history.replaceState(
      null,
      '',
      location.pathname + location.search + '#' + chosen,
    );
}
if (controls && select && panels.length) {
  controls.hidden = false;
  if (index) index.hidden = true;
  select.addEventListener('change', () => activate(select.value));
  window.addEventListener('hashchange', () =>
    activate(location.hash.slice(1), false),
  );
  const observer = new ResizeObserver(() =>
    panels.filter((panel) => !panel.hidden).forEach(draw),
  );
  panels.forEach((panel) => observer.observe(panel));
  activate(location.hash.slice(1), false);
  document
    .querySelector('[data-divergence-share]')
    ?.addEventListener('click', async () => {
      try {
        const url = new URL(location.href);
        url.hash = select.value;
        await navigator.clipboard.writeText(url.href);
        if (status) status.textContent = 'Lien de la carte copié.';
      } catch {
        if (status)
          status.textContent =
            'Copiez l’adresse de cette page pour partager la carte.';
      }
    });
  panels.forEach((panel) => {
    const highlight = (id: string | null) =>
      panel
        .querySelectorAll<SVGGElement>('[data-divergence-point]')
        .forEach((point) =>
          point.classList.toggle('is-focused', point.dataset.candidate === id),
        );
    panel
      .querySelectorAll<HTMLElement>('[data-focus-candidate]')
      .forEach((record) => {
        record.addEventListener('pointerenter', () =>
          highlight(record.dataset.focusCandidate || null),
        );
        record.addEventListener('pointerleave', () => highlight(null));
        record.addEventListener('focusin', () =>
          highlight(record.dataset.focusCandidate || null),
        );
        record.addEventListener('focusout', () => highlight(null));
      });
  });
}
