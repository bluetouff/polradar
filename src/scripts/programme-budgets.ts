import { domPager, hashSelectFilters } from './pager';
const form = document.querySelector<HTMLFormElement>('#budget-filters')!;
const candidate =
  document.querySelector<HTMLSelectElement>('#budget-candidate')!;
const period = document.querySelector<HTMLSelectElement>('#budget-period')!;
const status = document.querySelector<HTMLElement>('#budget-status')!;
const empty = document.querySelector<HTMLElement>('#budget-empty')!;
const groups = [
  ...document.querySelectorAll<HTMLElement>('[data-budget-candidate]'),
];
const fields = hashSelectFilters([
  [candidate, 'personnalite'],
  [period, 'periode'],
]);
const paginate = domPager(
  document.querySelector<HTMLElement>('[data-paged-results]')!,
  restore,
);
function restore() {
  fields.restore();
  const anchor = document.getElementById(location.hash.slice(1));
  const target = anchor?.matches('[data-budget-period]') ? anchor : null;
  render(false, target);
  target?.scrollIntoView();
}
function render(reset = true, target?: HTMLElement | null) {
  if (reset) fields.write();
  const matches: HTMLElement[] = [];
  let profiles = 0;
  for (const profile of groups) {
    const before = matches.length;
    const selected =
      !candidate.value || candidate.value === profile.dataset.budgetCandidate;
    for (const row of profile.querySelectorAll<HTMLElement>(
      '[data-budget-period]',
    )) {
      row.hidden =
        !selected ||
        Boolean(period.value && row.dataset.budgetPeriod !== period.value);
      if (!row.hidden) matches.push(row);
    }
    if (before !== matches.length) profiles++;
  }
  const amounts = matches.length;
  empty.hidden = amounts > 0;
  status.textContent = `${profiles} profil${profiles > 1 ? 's' : ''} · ${amounts} montant${amounts > 1 ? 's' : ''} documenté${amounts > 1 ? 's' : ''}`;
  paginate(matches, { reset, target });
  for (const profile of groups)
    profile.hidden = !profile.querySelector(
      '[data-budget-period]:not([hidden])',
    );
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
  period.value = '';
  render();
});
restore();
