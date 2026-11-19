import { domPager } from './pager';
const list = document.querySelector<HTMLElement>('[data-document-list]');
if (list) {
  const root = list.closest<HTMLElement>('[data-paged-results]')!;
  const rows = [
    ...list.querySelectorAll<HTMLElement>('[data-page-item],.measure-row'),
  ];
  const groups = [...list.querySelectorAll<HTMLElement>('[data-page-group]')];
  const paginate = domPager(root, restore);
  function restore() {
    const target = document.getElementById(location.hash.slice(1));
    const row =
      target && list!.contains(target)
        ? rows.find(
            (el) => el === target || target.contains(el) || el.contains(target),
          )
        : null;
    paginate(rows, { target: row });
    groups.forEach(
      (group) =>
        (group.hidden = !group.querySelector('.measure-row:not([hidden])')),
    );
    if (row && target) target.scrollIntoView();
  }
  restore();
}
