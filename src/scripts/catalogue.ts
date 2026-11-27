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
  discovery?: HTMLElement;
  onResults?: (rows: T[]) => void;
  onSubmit?: (filters: URLSearchParams) => boolean;
  onRestore?: () => void;
  localHistory?: boolean;
  initialQuery?: string;
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
  discovery,
  onResults,
  onSubmit,
  onRestore,
  localHistory = false,
  initialQuery,
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
  let sequence = 0;
  const recent = new Map<number, { page: number; filters: URLSearchParams }>();
  function remember(page: number, filters: URLSearchParams, replace = false) {
    const key = ++sequence;
    recent.set(key, { page, filters });
    if (recent.size > 40) recent.delete(key - 40);
    if (replace) history.replaceState({ searchStep: key }, '', base);
    else history.pushState({ searchStep: key }, '', base);
  }
  const draw = bindPager(root, (p) => {
    if (localHistory && selection.size) {
      remember(p, selection);
      void show(p, true);
      return;
    }
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
    const discover =
      discovery && !filters.size && pageRange(initialTotal, page).page === 1;
    if (discovery) {
      discovery.hidden = !discover;
      root.hidden = Boolean(discover);
    }
    if (discover) {
      count.textContent = '';
      onResults?.([]);
      return;
    }
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
      onResults?.(filtered ?? []);
      draw(range, (n) =>
        localHistory && filters.size
          ? base + '#resultats'
          : href(n, filters, true),
      );
      if (
        !localHistory &&
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
      onResults?.([]);
      results.replaceChildren(...initialCards);
      draw(
        pageRange(initialTotal, initial),
        (n) => pagePath(base, n) + '#resultats',
      );
    }
  }
  function restore() {
    onRestore?.();
    const key = history.state?.searchStep;
    const stored =
      localHistory && Number.isSafeInteger(key) ? recent.get(key) : undefined;
    const params =
      stored?.filters ?? new URLSearchParams(location.hash.slice(1));
    for (const el of controls) {
      if (el instanceof HTMLInputElement && el.type === 'checkbox')
        el.checked = params.get(el.name) === el.value;
      else el.value = (params.get(el.name) ?? '').slice(0, 200);
    }
    const pathPage =
      location.pathname.slice(base.length).match(/^page\/(\d+)\/$/)?.[1] ?? '1';
    void show(stored?.page ?? params.get('page') ?? pathPage);
  }
  function filter(push: boolean, focus = false) {
    const params = read();
    if (localHistory) {
      if (push) remember(1, params);
      void show(1, focus);
      return;
    }
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
    const submitted = onSubmit?.(read()) ?? false;
    filter(true, !submitted);
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
  if (localHistory && initialQuery) {
    remember(1, new URLSearchParams({ q: initialQuery }), true);
  }
  restore();
  form.hidden = false;
  return async () => select(await all(), read());
}
