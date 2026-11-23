import { groups } from '../lib/navigation';
const nav = document.querySelector<HTMLElement>('.site-navigation');

if (nav) {
  const section = nav.dataset.section;
  if (section !== undefined) {
    // The five links go straight to the corresponding native menus when scripts
    // are disabled. Replace them only after the whole expanded menu is ready.
    const focused = document.activeElement;
    const activeDesk =
      focused instanceof HTMLAnchorElement && focused.parentElement === nav
        ? focused.hash.slice('#menu-'.length)
        : undefined;
    const menus = groups.map((group) => {
      const details = document.createElement('details');
      details.setAttribute('name', 'rubriques');
      details.dataset.desk = group.id;
      const summary = document.createElement('summary');
      summary.className = 'menu-' + group.icon;
      summary.textContent = group.name;
      const links = document.createElement('div');
      for (const [href, label] of group.links) {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        if (href === section) {
          link.setAttribute(
            'aria-current',
            location.pathname === href ? 'page' : 'location',
          );
          details.dataset.current = 'true';
        }
        links.append(link);
      }
      details.append(summary, links);
      return details;
    });
    nav.replaceChildren(...menus);
    menus
      .find(({ dataset }) => dataset.desk === activeDesk)
      ?.querySelector('summary')
      ?.focus();
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
