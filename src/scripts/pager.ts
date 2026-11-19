import {
  pageSize,
  pageRange,
  pagerLinks,
  rangeText,
  type PageRange,
} from '../lib/pagination';

export function bindPager(root: HTMLElement, onPage: (page: number) => void) {
  const navs = [...root.querySelectorAll<HTMLElement>(':scope > [data-pager]')];
  root.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey
    )
      return;
    const a =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('[data-pager] a[data-page]')
        : null;
    if (!a || !navs.some((nav) => nav.contains(a))) return;
    event.preventDefault();
    onPage(Number(a.dataset.page));
  });
  return (r: PageRange, href: (page: number) => string) => {
    for (const nav of navs) {
      nav.hidden = r.pages === 1;
      nav.querySelector('.pager-range')!.textContent = rangeText(r);
      const links = pagerLinks(r).map((item) => {
        const clickable = item.number !== null && item.kind !== 'current';
        const el = document.createElement(clickable ? 'a' : 'span');
        el.className = 'pager-' + item.kind;
        el.textContent = item.text;
        if (el instanceof HTMLAnchorElement && item.number !== null) {
          el.href = href(item.number);
          el.dataset.page = String(item.number);
          el.setAttribute('aria-label', item.label);
        } else if (item.kind === 'current') {
          el.setAttribute('aria-current', 'page');
          el.setAttribute('aria-label', item.label);
        } else el.setAttribute('aria-hidden', 'true');
        return el;
      });
      nav.querySelector('.pager-links')!.replaceChildren(...links);
    }
  };
}

export function focusResults(root: HTMLElement) {
  root.focus({ preventScroll: true });
  root.scrollIntoView({ block: 'start' });
}

// Lists with native anchors keep their fragment for the targeted event, month or source.
export function domPager(root: HTMLElement, restore: () => void) {
  const href = (page: number, keepAnchor = false) => {
    const url = new URL(location.href);
    if (page > 1) url.searchParams.set('page', String(page));
    else url.searchParams.delete('page');
    if (!keepAnchor && !url.hash.includes('=')) url.hash = '';
    return url.pathname + url.search + url.hash;
  };
  const draw = bindPager(root, (page) => {
    history.pushState(null, '', href(page));
    restore();
    focusResults(root);
  });
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', restore);
  return (
    matches: HTMLElement[],
    options: { reset?: boolean; target?: HTMLElement | null } = {},
  ) => {
    const pos = options.target ? matches.indexOf(options.target) : -1;
    const wanted =
      pos >= 0
        ? Math.floor(pos / pageSize) + 1
        : options.reset
          ? 1
          : new URLSearchParams(location.search).get('page');
    const range = pageRange(matches.length, wanted);
    matches.forEach(
      (row, i) => (row.hidden = i < range.start || i >= range.end),
    );
    if (
      new URL(location.href).searchParams.get('page') !==
      (range.page === 1 ? null : String(range.page))
    )
      history.replaceState(null, '', href(range.page, true));
    draw(range, href);
    return range;
  };
}

export function listFilters(
  form: HTMLFormElement,
  fields: [HTMLInputElement | HTMLSelectElement, string][],
  render: () => void,
) {
  function change() {
    const url = new URL(location.href);
    url.searchParams.delete('page');
    url.hash = '';
    for (const [el, key] of fields) {
      if (el.value) url.searchParams.set(key, el.value.slice(0, 200));
      else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
    render();
  }
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', (e) => {
    if (e.target instanceof HTMLInputElement) change();
  });
  form.addEventListener('change', (e) => {
    if (e.target instanceof HTMLSelectElement) change();
  });
  form.addEventListener('reset', () => setTimeout(change, 0));
  form.hidden = false;
  return () => {
    const values = new URLSearchParams(location.search);
    for (const [el, key] of fields)
      el.value = (values.get(key) || '').slice(0, 200);
    render();
  };
}

export function hashSelectFilters(fields: [HTMLSelectElement, string][]) {
  return {
    restore() {
      const params = new URLSearchParams(location.hash.slice(1));
      for (const [control, key] of fields) {
        const value = params.get(key);
        control.value = [...control.options].some(
          (option) => option.value === value,
        )
          ? value!
          : control.options[0].value;
      }
    },
    write() {
      const url = new URL(location.href);
      const params = new URLSearchParams();
      for (const [control, key] of fields)
        if (control.value) params.set(key, control.value);
      url.hash = params.toString();
      url.searchParams.delete('page');
      if (url.href !== location.href) history.pushState(null, '', url);
    },
  };
}
