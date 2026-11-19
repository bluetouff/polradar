import { domPager, listFilters } from './pager';
import { normalize } from '../lib/features.mjs';

const form = document.querySelector<HTMLFormElement>('#campaign-filters')!;
const search = document.querySelector<HTMLInputElement>('#campaign-search')!;
const category =
  document.querySelector<HTMLSelectElement>('#campaign-category')!;
const candidate = document.querySelector<HTMLSelectElement>(
  '#campaign-candidate',
)!;
const status = document.querySelector<HTMLElement>('#campaign-status')!;
const months = [...document.querySelectorAll<HTMLElement>('.campaign-month')];
const root = document.querySelector<HTMLElement>('[data-paged-results]')!;
const paginate = domPager(root, () => restore());
const rows = [...root.querySelectorAll<HTMLElement>('.campaign-entry')];
function render() {
  const query = normalize(search.value);
  let total = 0;
  for (const month of months) {
    let count = 0;
    for (const row of month.querySelectorAll<HTMLElement>('.campaign-entry')) {
      row.hidden = Boolean(
        (category.value && row.dataset.category !== category.value) ||
        (candidate.value &&
          !(row.dataset.candidates || '')
            .split(' ')
            .includes(candidate.value)) ||
        (query && !normalize(row.dataset.search || '').includes(query)),
      );
      if (!row.hidden) count++;
    }
    month.hidden = count === 0;
    month.querySelector<HTMLElement>('[data-month-count]')!.textContent =
      String(count);
    const link = document.querySelector<HTMLElement>(
      `[data-month-link="${month.dataset.month}"]`,
    )!;
    link.hidden = count === 0;
    link.querySelector('b')!.textContent = String(count);
    link.dataset.visibleCount = String(count);
    total += count;
  }
  const links = [
    ...document.querySelectorAll<HTMLElement>('[data-month-link]'),
  ];
  const max = Math.max(
    1,
    ...links.map((link) => Number(link.dataset.visibleCount)),
  );
  for (const link of links)
    link
      .querySelector('.month-volume')!
      .setAttribute(
        'width',
        String((Number(link.dataset.visibleCount) / max) * 100),
      );
  const matched = rows.filter((row) => !row.hidden);
  const target = document.getElementById(location.hash.slice(1));
  const row = matched.find((el) => el === target || target?.contains(el));
  paginate(matched, { target: row });
  months.forEach(
    (month) =>
      (month.hidden = !month.querySelector('.campaign-entry:not([hidden])')),
  );
  if (row && target) target.scrollIntoView();
  status.textContent = `${total} événement${total > 1 ? 's' : ''}`;
  document.querySelector<HTMLElement>('#campaign-empty')!.hidden = total > 0;
}
const restore = listFilters(
  form,
  [
    [search, 'q'],
    [category, 'categorie'],
    [candidate, 'candidat'],
  ],
  render,
);
restore();
