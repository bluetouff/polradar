import { domPager, hashSelectFilters } from './pager';
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
const fields = hashSelectFilters([
  [candidate, 'personnalite'],
  [city, 'ville'],
  [week, 'semaine'],
  [period, 'periode'],
]);
const paginate = domPager(
  document.querySelector<HTMLElement>('[data-paged-results]')!,
  restore,
);
let matches: HTMLElement[] = [];
function restore() {
  fields.restore();
  const target = nodes.find((node) => node.id === location.hash.slice(1));
  if (target) period.value = 'tous';
  render(false, target);
  target?.scrollIntoView();
}
function render(reset = true, target?: HTMLElement) {
  if (reset) fields.write();
  const today = parisToday(),
    filters = {
      candidate: candidate.value,
      city: city.value,
      week: week.value,
      period: period.value,
    };
  matches = [];
  for (const node of nodes) {
    const event = {
      candidate: node.dataset.candidate,
      city: node.dataset.city,
      date: node.dataset.date!,
      latestPossibleDate: node.dataset.latestPossibleDate,
    };
    node.hidden = !agendaMatches(event, filters, today);
    if (!node.hidden) matches.push(node);
  }
  const count = matches.length;
  const towns = new Set(matches.map((n) => n.dataset.city).filter(Boolean));
  status.textContent = `${count} rendez-vous · ${towns.size} ville${towns.size > 1 ? 's' : ''}`;
  let hasSourceNote = false;
  for (const note of document.querySelectorAll<HTMLElement>(
    '[data-agenda-check]',
  )) {
    note.hidden = count > 0 || note.dataset.agendaCheck !== candidate.value;
    if (!note.hidden) hasSourceNote = true;
  }
  document.querySelector<HTMLElement>('#agenda-empty')!.hidden =
    count > 0 || hasSourceNote;
  choices.hidden = true;
  choices.replaceChildren();
  for (const marker of document.querySelectorAll<SVGAElement>(
    '[data-map-cities]',
  )) {
    const ids = (marker.dataset.mapCities || '').split(' '),
      visible = matches.filter((n) => ids.includes(n.dataset.city || ''));
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
  paginate(matches, { reset, target });
}
for (const marker of document.querySelectorAll<SVGAElement>(
  '[data-map-cities]',
)) {
  marker.addEventListener('click', (event) => {
    event.preventDefault();
    const ids = (marker.dataset.mapCities || '')
      .split(' ')
      .filter((id) => matches.some((n) => n.dataset.city === id));
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
form.hidden = false;
const controls = form.closest<HTMLDetailsElement>('.visual-controls')!;
controls.hidden = false;
const wide = window.matchMedia('(min-width: 761px)');
controls.open = wide.matches;
wide.addEventListener('change', (event) => {
  controls.open = event.matches;
});
form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('change', () => render());
form.addEventListener('reset', (event) => {
  event.preventDefault();
  candidate.value = '';
  city.value = '';
  week.value = '';
  period.value = 'a-venir';
  render();
});
restore();
