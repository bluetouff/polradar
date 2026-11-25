import { pagePath, pageRange } from '../lib/pagination';
import { bindPager, focusResults } from './pager';

interface Options<T> {
  form: HTMLFormElement;
  results: HTMLElement;
  count: HTMLElement;
  load: () => Promise<T[]>;
  select: (rows: T[], filters: URLSearchParams) => T[];
  card: (item: T) => HTMLElement;
  noun?: string;
  empty?: () => Node;
}
export function catalogue<T>({
  form,
  results,
  count,
  load,
  select,
  card,
  noun = 'résultat',
  empty,
}: Options<T>) {
  const root = results.closest<HTMLElement>('[data-paged-results]')!;
  const base = root.dataset.base!;
  const initial = Number(root.dataset.initialPage);
  const initialTotal = Number(root.dataset.total);
  const initialCards = [...results.children];
  const controls = [...form.elements].filter(
    (el): el is HTMLInputElement | HTMLSelectElement =>
      (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) &&
      Boolean(el.name),
  );
  let pending: Promise<T[]> | undefined;
  let generation = 0;
  const all = () =>
    (pending ??= load().catch((error) => {
      pending = undefined;
      throw error;
    }));
  const read = () => {
    const p = new URLSearchParams();
    for (const el of controls) {
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        if (el.checked) p.set(el.name, el.value);
      } else if (el.value) p.set(el.name, el.value.slice(0, 200));
    }
    return p;
  };
  const href = (page: number, filters: URLSearchParams, anchor = false) => {
    const p = new URLSearchParams(filters);
    if (p.size) {
      if (page > 1) p.set('page', String(page));
      return base + '#' + p;
    }
    return pagePath(base, page) + (anchor ? '#resultats' : '');
  };
  let selection = new URLSearchParams();
  const draw = bindPager(root, (p) => {
    const url = href(p, selection, true);
    if (!selection.size) {
      location.assign(url);
      return;
    }
    history.pushState(null, '', url);
    void show(p, true);
  });
  async function show(page: number | string | null, focus = false) {
    const ticket = ++generation;
    const filters = read();
    selection = filters;
    try {
      const useInitial =
        !filters.size && pageRange(initialTotal, page).page === initial;
      const filtered = useInitial ? null : select(await all(), filters);
      if (ticket !== generation) return;
      const range = pageRange(filtered?.length ?? initialTotal, page);
      results.replaceChildren(
        ...(filtered
          ? filtered.slice(range.start, range.end).map(card)
          : initialCards),
      );
      if (!range.total) {
        const fallback = document.createElement('p');
        fallback.className = 'empty-results';
        fallback.textContent = 'Aucun résultat pour ces filtres.';
        results.replaceChildren(empty?.() ?? fallback);
      }
      count.textContent = `${range.total} ${noun}${range.total > 1 ? 's' : ''}`;
      draw(range, (n) => href(n, filters, true));
      if (
        (filters.size ||
          new URLSearchParams(location.hash.slice(1)).has('page')) &&
        location.pathname + location.hash !== href(range.page, filters)
      )
        history.replaceState(null, '', href(range.page, filters));
      if (focus) focusResults(root);
    } catch {
      if (ticket !== generation) return;
      count.textContent =
        'Filtres indisponibles. Les pages du catalogue restent consultables.';
      selection = new URLSearchParams();
      results.replaceChildren(...initialCards);
      draw(
        pageRange(initialTotal, initial),
        (n) => pagePath(base, n) + '#resultats',
      );
    }
  }
  function restore() {
    const params = new URLSearchParams(location.hash.slice(1));
    for (const el of controls) {
      if (el instanceof HTMLInputElement && el.type === 'checkbox')
        el.checked = params.get(el.name) === el.value;
      else el.value = (params.get(el.name) ?? '').slice(0, 200);
    }
    const pathPage =
      location.pathname.slice(base.length).match(/^page\/(\d+)\/$/)?.[1] ?? '1';
    void show(params.get('page') ?? pathPage);
  }
  function filter(push: boolean, focus = false) {
    const params = read();
    const url = href(1, params);
    if (location.pathname + location.hash !== url) {
      const oldHash = new URLSearchParams(location.hash.slice(1));
      if (
        push ||
        !oldHash.has('q') ||
        oldHash.has('page') ||
        location.pathname !== base
      )
        history.pushState(null, '', url);
      else history.replaceState(null, '', url);
    }
    void show(1, focus);
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    filter(true, true);
  });
  form.addEventListener('input', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox')
      filter(false);
  });
  form.addEventListener('change', (e) => {
    if (
      e.target instanceof HTMLSelectElement ||
      (e.target instanceof HTMLInputElement && e.target.type === 'checkbox')
    )
      filter(true);
  });
  form.addEventListener('reset', () => setTimeout(() => filter(true), 0));
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', restore);
  restore();
  form.hidden = false;
  return async () => select(await all(), read());
}
