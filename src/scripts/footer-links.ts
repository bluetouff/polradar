import { footerColumns } from '../lib/footer-links';

const nav = document.querySelector<HTMLElement>('[data-footer-links]');
if (nav) {
  const groups = footerColumns.map(({ title, icon, links }) => {
    const group = document.createElement('div');
    const heading = document.createElement('h2');
    heading.className = 'menu-' + icon;
    heading.textContent = title;
    const list = document.createElement('div');
    list.className = 'footer-links';
    for (const [href, label] of links) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      list.append(link);
    }
    group.append(heading, list);
    return group;
  });
  nav.replaceChildren(...groups);
}
