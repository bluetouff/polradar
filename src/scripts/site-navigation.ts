import { groups } from '../lib/navigation';
const nav = document.querySelector<HTMLElement>('.site-navigation');

if (nav) {
  for (const entry of nav.querySelectorAll<HTMLAnchorElement>(
    'a[href^="/#menu-"]',
  )) {
    const group = groups.find(
      ({ id }) => id === entry.hash.slice('#menu-'.length),
    );
    if (!group) continue;
    const list = entry.parentElement;
    if (!list) continue;
    const current = list.querySelector<HTMLAnchorElement>('a[aria-current]');
    list.replaceChildren(
      ...group.links.map(([href, label]) => {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        if (current?.getAttribute('href') === href)
          link.setAttribute(
            'aria-current',
            current.getAttribute('aria-current')!,
          );
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
