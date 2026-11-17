import { normalize } from '../lib/features.mjs';
const filters = document.querySelector<HTMLFormElement>('#market-filters')!;
const search = document.querySelector<HTMLInputElement>('#market-search')!;
const provider = document.querySelector<HTMLSelectElement>('#market-provider')!;
const status = document.querySelector<HTMLElement>('#market-status')!;
const boards = [...document.querySelectorAll<HTMLElement>('.market-board')];
function render() {
  const query = normalize(search.value);
  let count = 0;
  for (const board of boards) {
    board.hidden = Boolean(
      provider.value && board.dataset.provider !== provider.value,
    );
    let visible = 0;
    for (const row of board.querySelectorAll<HTMLElement>('.market-row')) {
      row.hidden = !normalize(row.dataset.marketName || '').includes(query);
      if (!row.hidden) visible++;
    }
    const more = board.querySelector<HTMLDetailsElement>('.market-more');
    if (more) more.open = Boolean(query);
    const empty = board.querySelector<HTMLElement>('.market-empty');
    if (empty) empty.hidden = visible > 0;
    if (!board.hidden) count += visible;
  }
  status.textContent = query
    ? `${count} contrat${count > 1 ? 's' : ''} correspondant${count > 1 ? 's' : ''}`
    : '';
}
function freshness() {
  for (const board of boards) {
    const notice = board.querySelector<HTMLElement>('.market-freshness')!;
    const age = Date.now() - Date.parse(board.dataset.observedAt || '');
    notice.hidden = !Number.isFinite(age) || age <= 6 * 60 * 60 * 1000;
    notice.textContent =
      'Relevé de plus de six heures. Les prix ont pu évoluer depuis.';
  }
}
filters.hidden = false;
filters.addEventListener('submit', (event) => event.preventDefault());
search.addEventListener('input', render);
provider.addEventListener('change', render);
freshness();
setInterval(freshness, 60000);
