export {};
const form = document.querySelector<HTMLFormElement>('#budget-filters')!;
const candidate =
  document.querySelector<HTMLSelectElement>('#budget-candidate')!;
const period = document.querySelector<HTMLSelectElement>('#budget-period')!;
const status = document.querySelector<HTMLElement>('#budget-status')!;
const empty = document.querySelector<HTMLElement>('#budget-empty')!;
function render() {
  let profiles = 0,
    amounts = 0;
  for (const profile of document.querySelectorAll<HTMLElement>(
    '[data-budget-candidate]',
  )) {
    let visible = 0;
    for (const row of profile.querySelectorAll<HTMLElement>(
      '[data-budget-period]',
    )) {
      row.hidden = Boolean(
        period.value && row.dataset.budgetPeriod !== period.value,
      );
      if (!row.hidden) visible++;
    }
    profile.hidden = Boolean(
      (candidate.value &&
        profile.dataset.budgetCandidate !== candidate.value) ||
      !visible,
    );
    if (!profile.hidden) {
      profiles++;
      amounts += visible;
    }
  }
  empty.hidden = amounts > 0;
  status.textContent = `${profiles} profil${profiles > 1 ? 's' : ''} · ${amounts} montant${amounts > 1 ? 's' : ''} documenté${amounts > 1 ? 's' : ''}`;
  const params = new URLSearchParams();
  if (candidate.value) params.set('personnalite', candidate.value);
  if (period.value) params.set('periode', period.value);
  history.replaceState(
    null,
    '',
    `${location.pathname}${params.size ? '#' + params : ''}`,
  );
}
const params = new URLSearchParams(location.hash.slice(1));
for (const [control, key] of [
  [candidate, 'personnalite'],
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
  period.value = '';
  render();
});
render();
