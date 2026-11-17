import { agendaMatches, parisToday } from '../lib/campaign-visuals-view.mjs';
const form = document.querySelector<HTMLFormElement>('#agenda-filters')!;
const candidate =
  document.querySelector<HTMLSelectElement>('#agenda-candidate')!;
const city = document.querySelector<HTMLSelectElement>('#agenda-city')!;
const week = document.querySelector<HTMLSelectElement>('#agenda-week')!;
const period = document.querySelector<HTMLSelectElement>('#agenda-period')!;
const status = document.querySelector<HTMLElement>('#agenda-status')!;
const choices = document.querySelector<HTMLElement>('#map-city-choices')!;
const nodes = [...document.querySelectorAll<HTMLElement>('[data-agenda-id]')];
function render() {
  const today = parisToday(),
    filters = {
      candidate: candidate.value,
      city: city.value,
      week: week.value,
      period: period.value,
    };
  let count = 0;
  for (const node of nodes) {
    const event = {
      candidate: node.dataset.candidate,
      city: node.dataset.city,
      date: node.dataset.date!,
    };
    node.hidden = !agendaMatches(event, filters, today);
    if (!node.hidden) count++;
  }
  const towns = new Set(
    nodes
      .filter((n) => !n.hidden)
      .map((n) => n.dataset.city)
      .filter(Boolean),
  );
  status.textContent = `${count} rendez-vous · ${towns.size} ville${towns.size > 1 ? 's' : ''}`;
  document.querySelector<HTMLElement>('#agenda-empty')!.hidden = count > 0;
  choices.hidden = true;
  choices.replaceChildren();
  for (const marker of document.querySelectorAll<SVGAElement>(
    '[data-map-cities]',
  )) {
    const ids = (marker.dataset.mapCities || '').split(' '),
      visible = nodes.filter(
        (n) => !n.hidden && ids.includes(n.dataset.city || ''),
      );
    marker.setAttribute('visibility', visible.length ? 'visible' : 'hidden');
    marker.setAttribute('tabindex', visible.length ? '0' : '-1');
    marker.setAttribute('aria-hidden', String(!visible.length));
    marker.querySelector('.map-count')!.textContent = String(visible.length);
    const activeIds = ids.filter((id) =>
      visible.some((node) => node.dataset.city === id),
    );
    const names = activeIds
      .map((id) => [...city.options].find((o) => o.value === id)?.textContent)
      .filter(Boolean)
      .join(', ');
    marker.querySelector('.map-label')!.textContent =
      activeIds.length === 1 ? names : `${activeIds.length} villes`;
    marker.querySelector('title')!.textContent = names;
    marker.setAttribute(
      'aria-label',
      `${names} : ${visible.length} rendez-vous`,
    );
  }
  const params = new URLSearchParams();
  for (const [control, key] of [
    [candidate, 'personnalite'],
    [city, 'ville'],
    [week, 'semaine'],
    [period, 'periode'],
  ] as const)
    if (control.value) params.set(key, control.value);
  history.replaceState(null, '', `${location.pathname}#${params}`);
}
for (const marker of document.querySelectorAll<SVGAElement>(
  '[data-map-cities]',
)) {
  marker.addEventListener('click', (event) => {
    event.preventDefault();
    const ids = (marker.dataset.mapCities || '')
      .split(' ')
      .filter((id) => nodes.some((n) => !n.hidden && n.dataset.city === id));
    if (ids.length === 1) {
      city.value = ids[0];
      render();
      return;
    }
    choices.replaceChildren();
    choices.hidden = false;
    for (const id of ids) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent =
        [...city.options].find((o) => o.value === id)?.textContent || id;
      button.addEventListener('click', () => {
        city.value = id;
        render();
      });
      choices.append(button);
    }
    choices.querySelector('button')?.focus();
  });
}
const params = new URLSearchParams(location.hash.slice(1));
for (const [control, key] of [
  [candidate, 'personnalite'],
  [city, 'ville'],
  [week, 'semaine'],
  [period, 'periode'],
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
form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('change', render);
form.addEventListener('reset', (event) => {
  event.preventDefault();
  candidate.value = '';
  city.value = '';
  week.value = '';
  period.value = 'a-venir';
  render();
});
render();
