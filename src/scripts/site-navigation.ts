const nav = document.querySelector<HTMLElement>('[data-site-navigation]');

if (nav) {
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
