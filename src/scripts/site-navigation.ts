const directory = document.querySelector<HTMLDetailsElement>('.site-directory');

if (directory) {
  const page = document.querySelector<HTMLElement>('.page-column');
  directory.addEventListener('toggle', () => {
    if (page) page.inert = directory.open;
  });
  directory.addEventListener('focusout', (event) => {
    if (
      event.relatedTarget instanceof Node &&
      !directory.contains(event.relatedTarget)
    )
      directory.open = false;
  });
  document.addEventListener('click', (event) => {
    if (
      directory.open &&
      event.target instanceof Node &&
      !directory.contains(event.target)
    ) {
      directory.open = false;
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !directory.open) return;
    const restore = directory.contains(document.activeElement);
    directory.open = false;
    if (restore) directory.querySelector('summary')?.focus();
  });
}
