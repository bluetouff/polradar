import { groups } from '../lib/navigation';
const nav = document.querySelector<HTMLElement>('[data-site-navigation]');

if (nav) {
  for (const entry of nav.querySelectorAll<HTMLAnchorElement>(
    'a[data-menu-links]',
  )) {
    const group = groups.find(({ id }) => id === entry.dataset.menuLinks);
    if (!group) continue;
    entry.replaceWith(
      ...group.links.map(([href, label]) => {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        return link;
      }),
    );
  }
  const opened = () => nav.querySelector<HTMLDetailsElement>('details[open]');
  document.addEventListener('click', (event) => {
    if (event.target instanceof Node && !nav.contains(event.target)) {
      opened()?.removeAttribute('open');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const menu = opened();
    if (!menu) return;
    const restore = menu.contains(document.activeElement);
    menu.open = false;
    if (restore) menu.querySelector('summary')?.focus();
  });
}
