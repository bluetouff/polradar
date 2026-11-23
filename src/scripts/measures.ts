import { corpus, measureCard } from './ui';
import { catalogue } from './catalogue';
import { focusResults } from './pager';
import { filterEntries, measureSearchText } from '../lib/features.mjs';
import type { Corpus, Measure } from '../lib/data';
let data: Corpus;
catalogue<Measure & { text: string }>({
  form: document.querySelector<HTMLFormElement>('#measure-filters')!,
  results: document.querySelector<HTMLElement>('#measure-results')!,
  count: document.querySelector<HTMLElement>('#measure-count')!,
  load: async () => {
    data = await corpus();
    const names = new Map(data.candidates.map((c) => [c.id, c.name]));
    const themes = new Map(data.themes.map((t) => [t.id, t.label]));
    return data.measures.map((m) => ({
      ...m,
      text: measureSearchText(m, names.get(m.candidate), themes.get(m.theme)),
    }));
  },
  select: (rows, filters) => filterEntries(rows, Object.fromEntries(filters)),
  card: (row) => measureCard(row, data),
});

document.querySelector('.coverage-bars')?.addEventListener('click', (event) => {
  if (
    !(event instanceof MouseEvent) ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const link =
    event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>('a[data-filter-theme]')
      : null;
  if (!link?.dataset.filterTheme) return;
  event.preventDefault();
  location.hash = new URLSearchParams({
    theme: link.dataset.filterTheme,
  }).toString();
  focusResults(document.querySelector<HTMLElement>('#resultats')!);
});
