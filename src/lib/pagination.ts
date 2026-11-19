export const pageSize = 12;

export function pageRange(
  total: number,
  requested: string | number | null = 1,
) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const raw = String(requested ?? '');
  const page = /^\d+$/.test(raw)
    ? Math.min(pages, Math.max(1, Number(raw)))
    : 1;
  const start = (page - 1) * pageSize;
  return { page, pages, start, end: Math.min(total, start + pageSize), total };
}
export type PageRange = ReturnType<typeof pageRange>;

export function pagePath(base: string, page: number) {
  return page === 1 ? base : `${base}page/${page}/`;
}
export function pagesFor(total: number) {
  return Array.from(
    { length: pageRange(total).pages },
    (_, index) => index + 1,
  );
}
export function pageNumbers({ page, pages }: PageRange): (number | null)[] {
  const numbers = [1, page - 1, page, page + 1, pages].filter(
    (n) => n >= 1 && n <= pages,
  );
  const result: (number | null)[] = [];
  let previous = 0;
  for (const n of new Set(numbers.sort((a, b) => a - b))) {
    if (n - previous === 2) result.push(previous + 1);
    else if (n - previous > 2) result.push(null);
    result.push(n);
    previous = n;
  }
  return result;
}
export function rangeText(r: PageRange) {
  return r.total ? `${r.start + 1} à ${r.end} sur ${r.total}` : '0 résultat';
}
export function pagerLinks(r: PageRange) {
  return [
    {
      kind: 'prev',
      text: '‹',
      label: 'Page précédente',
      number: r.page > 1 ? r.page - 1 : null,
    },
    ...pageNumbers(r).map((n) => ({
      kind: n === null ? 'gap' : n === r.page ? 'current' : 'number',
      text: n === null ? '…' : String(n),
      label: n === null ? '' : `Page ${n}`,
      number: n,
    })),
    {
      kind: 'next',
      text: '›',
      label: 'Page suivante',
      number: r.page < r.pages ? r.page + 1 : null,
    },
  ];
}
