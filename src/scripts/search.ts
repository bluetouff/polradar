import { catalogue } from './catalogue';
import { documentaryAnswer } from './answer-results';
import { takeSearchHandoff } from './search-handoff';
import {
  documentaryKeywords,
  isDocumentaryQuestion,
} from '../lib/search-intent';
import { savedParameters, saveView } from './saved-views';
import { el, anchor, icon, download, publicData } from './ui';
import { filterEntries, exportCsv } from '../lib/features.mjs';
import {
  searchIcon,
  searchKinds,
  searchResultLabel,
} from '../lib/search-kinds';
import type { SearchEntry } from '../lib/search';
const form = document.querySelector<HTMLFormElement>('#search-form')!,
  results = document.querySelector<HTMLElement>('#search-results')!,
  count = document.querySelector<HTMLElement>('#search-count')!;
const options = document.querySelector<HTMLDetailsElement>('#search-options')!;
function revealActiveFilters() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (
    ['candidate', 'theme', 'type', 'year', 'archives'].some((key) =>
      params.has(key),
    )
  )
    options.open = true;
}
revealActiveFilters();
window.addEventListener('hashchange', revealActiveFilters);
const empty = document.querySelector<HTMLTemplateElement>('#search-empty')!;
const discovery = document.querySelector<HTMLElement>('#search-discovery')!;
const toolbar = document.querySelector<HTMLElement>('.search-toolbar')!;
const typeNav = document.querySelector<HTMLElement>('#search-types')!;
const typeSelect = form.querySelector<HTMLSelectElement>('[name=type]')!;
const saveButton = document.querySelector<HTMLButtonElement>('#search-save')!;
const answer = documentaryAnswer();
const initialQuery = takeSearchHandoff();
function requestAnswer(filters: URLSearchParams) {
  const query = filters.get('q')?.trim() ?? '';
  if (filters.size !== 1 || !isDocumentaryQuestion(query)) return false;
  void answer.lookup(query);
  return true;
}
form.addEventListener('input', () => answer.clear());
form.addEventListener('reset', () => answer.clear());

function searchView() {
  const state = new URLSearchParams();
  const names = [];
  for (const input of form.querySelectorAll<
    HTMLInputElement | HTMLSelectElement
  >('input[name], select[name]')) {
    if (
      !input.value ||
      (input instanceof HTMLInputElement &&
        input.type === 'checkbox' &&
        !input.checked)
    )
      continue;
    state.set(input.name, input.value);
    names.push(
      input instanceof HTMLSelectElement
        ? input.selectedOptions[0]?.text
        : input.type === 'checkbox'
          ? 'Archives 2022'
          : input.value.trim(),
    );
  }
  return { state, title: names.filter(Boolean).join(' · ') };
}

saveButton.addEventListener('click', async () => {
  const { state, title } = searchView();
  count.textContent = await saveView('search', state, title);
});
results.addEventListener('click', (event) => {
  if (
    !(event.target instanceof HTMLElement) ||
    !event.target.closest('[data-reset-search]')
  )
    return;
  form.reset();
  form.querySelector<HTMLInputElement>('#search-query')?.focus();
});
const selection = catalogue<SearchEntry>({
  form,
  results,
  count,
  discovery,
  localHistory: true,
  initialQuery,
  onSubmit: requestAnswer,
  onRestore: answer.clear,
  onResults(rows) {
    toolbar.hidden = !discovery.hidden;
    saveButton.hidden = !savedParameters('search', searchView().state);
    const totals = new Map<string, number>();
    for (const { type } of rows) totals.set(type, (totals.get(type) ?? 0) + 1);
    typeNav.replaceChildren();
    if (discovery.hidden && (totals.size > 1 || typeSelect.value)) {
      const options: [string, string][] = typeSelect.value
        ? [['', 'Tous les types de résultats']]
        : [...totals].map(([id, count]) => [
            id,
            `${searchKinds[id] ?? id} · ${count}`,
          ]);
      for (const [id, label] of options) {
        const button = el('button', label, 'button small');
        button.type = 'button';
        button.addEventListener('click', () => {
          typeSelect.value = id;
          answer.clear();
          typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
        typeNav.append(button);
      }
    }
    typeNav.hidden = !typeNav.childElementCount;
  },
  empty: () => empty.content.cloneNode(true),
  load: () => publicData<SearchEntry[]>('/api/recherche.json'),
  select: (entries, params) =>
    filterEntries(entries, {
      ...Object.fromEntries(params),
      q: documentaryKeywords(params.get('q') ?? ''),
    }),
  card: (entry) => {
    const article = el('article', undefined, 'advanced-result');
    const symbol = el('span', undefined, 'result-symbol');
    symbol.append(icon(searchIcon(entry.type, entry.theme)));
    const body = el('div'),
      h2 = el('h2'),
      link = anchor(entry.title, entry.url);
    if (entry.url.startsWith('https:')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    h2.append(link);
    const summary = entry.summary ?? entry.text;
    body.append(
      el('p', searchResultLabel(entry), 'result-meta'),
      h2,
      el('p', summary.slice(0, 220) + (summary.length > 220 ? '…' : '')),
    );
    const arrow = el('span', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    article.append(symbol, body, arrow);
    return article;
  },
});
if (initialQuery) requestAnswer(new URLSearchParams({ q: initialQuery }));
async function exportSelection(format: 'csv' | 'json') {
  try {
    const rows = await selection();
    if (format === 'csv')
      download(
        exportCsv(rows),
        'text/csv;charset=utf-8',
        'polradar-recherche.csv',
      );
    else
      download(
        JSON.stringify(rows, null, 2),
        'application/json;charset=utf-8',
        'polradar-recherche.json',
      );
  } catch {
    count.textContent =
      'Export indisponible. Réessayez lorsque l’index sera accessible.';
  }
}
for (const format of ['csv', 'json'] as const)
  document
    .querySelector('#export-' + format)!
    .addEventListener('click', () => void exportSelection(format));
document.querySelector('#search-share')!.addEventListener('click', async () => {
  const shared = new URL('/recherche/', location.origin);
  shared.hash = searchView().state.toString();
  try {
    await navigator.clipboard.writeText(shared.href);
    count.textContent = 'Lien de recherche copié.';
  } catch {
    count.textContent = 'Le lien n’a pas pu être copié.';
  }
});
