import { domPager, listFilters } from './pager';
import { normalize } from '../lib/features.mjs';

const form = document.querySelector<HTMLFormElement>('#watch-filters')!;
const search = document.querySelector<HTMLInputElement>('#watch-search')!;
const state = document.querySelector<HTMLSelectElement>('#watch-state')!;
const format = document.querySelector<HTMLSelectElement>('#watch-format')!;
const status = document.querySelector<HTMLElement>('#watch-filter-status')!;
const mapCount = document.querySelector<HTMLElement>('#watch-map-count')!;
const empty = document.querySelector<HTMLElement>('#watch-empty')!;
const cards = [
  ...document.querySelectorAll<HTMLElement>('[data-watch-source]'),
];
const cells = new Map(
  [...document.querySelectorAll<HTMLElement>('[data-watch-cell]')].map(
    (cell) => [cell.dataset.watchCell, cell],
  ),
);

const root = document.querySelector<HTMLElement>('[data-paged-results]')!;
const paginate = domPager(root, () => restore());
function render() {
  const query = normalize(search.value.slice(0, 200));
  let visible = 0;
  for (const card of cards) {
    card.hidden = Boolean(
      (state.value && card.dataset.watchStatus !== state.value) ||
      (format.value && card.dataset.watchFormat !== format.value) ||
      (query && !normalize(card.dataset.watchSearch || '').includes(query)),
    );
    cells.get(card.dataset.watchSource)!.hidden = card.hidden;
    if (!card.hidden) visible++;
  }
  const target = document.getElementById(location.hash.slice(1));
  const matches = cards.filter((c) => !c.hidden);
  paginate(matches, { target });
  if (target && matches.includes(target)) target.scrollIntoView();
  const label = `${visible} source${visible > 1 ? 's' : ''}`;
  status.textContent = label;
  mapCount.textContent = label;
  empty.hidden = visible > 0;
}
const restore = listFilters(
  form,
  [
    [search, 'q'],
    [state, 'etat'],
    [format, 'format'],
  ],
  render,
);
restore();
