import snapshot from '../data/airtime.json';
import { airtimeView, formatDuration } from '../lib/airtime-view.mjs';
const form = document.querySelector<HTMLFormElement>('#airtime-filters')!;
const month = document.querySelector<HTMLSelectElement>('#airtime-month')!;
const kind = document.querySelector<HTMLSelectElement>('#airtime-kind')!;
const candidate =
  document.querySelector<HTMLSelectElement>('#airtime-candidate')!;
const status = document.querySelector<HTMLElement>('#airtime-status')!;
const legend = document.querySelector<HTMLElement>('#airtime-legend')!;
const names = new Map(
  [...candidate.options].map((o) => [o.value, o.textContent || '']),
);
function render() {
  const view = airtimeView(snapshot, month.value, kind.value, candidate.value);
  for (const panel of document.querySelectorAll<HTMLElement>(
    '[data-airtime-month]',
  )) {
    panel.hidden = panel.dataset.airtimeMonth !== month.value;
    if (panel.hidden) continue;
    panel.querySelector<HTMLDetailsElement>('.airtime-month-detail')!.open =
      true;
    panel.querySelector('.airtime-month-detail > summary > span')!.textContent =
      `${view.rows.length} médias`;
    for (const node of panel.querySelectorAll<HTMLElement>('.airtime-row')) {
      const row = view.rows.find(
        (r: { name: string }) => r.name === node.dataset.service,
      );
      node.hidden = !row;
      if (!row) continue;
      const svg = node.querySelector('svg')!;
      svg.setAttribute(
        'aria-label',
        `${row.name} : répartition des durées publiées, total ${formatDuration(row.totalSeconds)}`,
      );
      for (const [i, rect] of [
        ...svg.querySelectorAll<SVGRectElement>('[data-segment]'),
      ].entries()) {
        const part = row.segments[i];
        rect.setAttribute('x', String(part?.x ?? 0));
        rect.setAttribute('width', String(part?.width ?? 0));
        rect.querySelector('title')!.textContent = part
          ? `${names.get(part.id)} : ${formatDuration(part.seconds)}`
          : '';
      }
      const other = svg.querySelector<SVGRectElement>('.airtime-other')!;
      other.setAttribute('x', String(row.othersX));
      other.setAttribute('width', String(row.othersWidth));
      other.querySelector('title')!.textContent =
        `Autres personnalités : ${formatDuration(row.others)}`;
      node.querySelector<HTMLElement>('.airtime-focus')!.textContent =
        candidate.value
          ? `${names.get(candidate.value)} : ${formatDuration(row.segments[0]?.seconds ?? null)}`
          : '';
      for (const person of node.querySelectorAll<HTMLElement>(
        '[data-airtime-person]',
      ))
        person.hidden = Boolean(
          candidate.value && person.dataset.airtimePerson !== candidate.value,
        );
    }
  }
  legend.replaceChildren();
  view.leaders.forEach((id: string, i: number) => {
    const item = document.createElement('span'),
      swatch = document.createElement('i');
    swatch.className = `tone-${i}`;
    swatch.setAttribute('aria-hidden', 'true');
    item.append(swatch, document.createTextNode(names.get(id) || id));
    legend.append(item);
  });
  const other = document.createElement('span'),
    swatch = document.createElement('i');
  swatch.className = 'airtime-other';
  swatch.setAttribute('aria-hidden', 'true');
  other.append(swatch, document.createTextNode('Autres personnalités'));
  legend.append(other);
  const published = view.rows.filter(
    (r: { totalSeconds: number | null }) => r.totalSeconds !== null,
  ).length;
  status.textContent = `${month.selectedOptions[0].textContent} · ${view.rows.length} médias · ${published} avec des durées publiées${candidate.value ? ` · ${names.get(candidate.value)}` : ''}`;
  const params = new URLSearchParams();
  params.set('mois', month.value);
  params.set('media', kind.value);
  if (candidate.value) params.set('personnalite', candidate.value);
  history.replaceState(null, '', `${location.pathname}#${params}`);
}
const params = new URLSearchParams(location.hash.slice(1));
for (const [control, key] of [
  [month, 'mois'],
  [kind, 'media'],
  [candidate, 'personnalite'],
] as const) {
  const value = params.get(key);
  if (value !== null && [...control.options].some((o) => o.value === value))
    control.value = value;
}
form.hidden = false;
const controls = form.closest<HTMLDetailsElement>('.visual-controls')!;
controls.hidden = false;
const wide = window.matchMedia('(min-width: 761px)');
controls.open = wide.matches;
wide.addEventListener('change', (event) => {
  controls.open = event.matches;
});
legend.hidden = false;
for (const staticLegend of document.querySelectorAll<HTMLElement>(
  '.airtime-static-legend',
))
  staticLegend.hidden = true;
form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('change', render);
form.addEventListener('reset', (event) => {
  event.preventDefault();
  month.value = snapshot.months[0].month;
  kind.value = 'television';
  candidate.value = '';
  render();
});
render();
