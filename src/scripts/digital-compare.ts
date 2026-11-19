export {};

const controls = document.querySelector<HTMLFieldSetElement>(
  '#digital-profile-controls',
)!;
const selects = [
  ...controls.querySelectorAll<HTMLSelectElement>('[data-digital-select]'),
];
const feedback = document.querySelector<HTMLElement>(
  '#digital-profile-status',
)!;
const defaults = selects.map((select) => select.value);
const allowed = new Set([...selects[0].options].map((option) => option.value));
const rows = [
  ...document.querySelectorAll<HTMLElement>('[data-digital-cells]'),
].map((container) => ({
  container,
  cells: new Map(
    [...container.querySelectorAll<HTMLElement>('[data-digital-profile]')].map(
      (cell) => [cell.dataset.digitalProfile!, cell],
    ),
  ),
}));

function render(requested: string[], save: boolean) {
  const valid =
    requested.length === defaults.length &&
    new Set(requested).size === defaults.length &&
    requested.every((id) => allowed.has(id));
  const active = valid ? requested : defaults;
  selects.forEach((select, index) => {
    select.value = active[index];
    for (const option of select.options)
      option.disabled =
        option.value !== select.value && active.includes(option.value);
  });
  for (const { container, cells } of rows) {
    for (const [id, cell] of cells) cell.hidden = !active.includes(id);
    for (const id of active) container.append(cells.get(id)!);
  }
  if (save) {
    const selection = new URLSearchParams({ profils: active.join(',') });
    history.replaceState(null, '', `${location.pathname}#${selection}`);
    feedback.textContent = 'Comparaison mise à jour.';
  }
}

function restoreSelection() {
  const hash = new URLSearchParams(location.hash.slice(1));
  render((hash.get('profils') ?? '').split(','), false);
}
restoreSelection();
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#profils=')) restoreSelection();
});
controls.hidden = false;
controls.addEventListener('change', () =>
  render(
    selects.map((select) => select.value),
    true,
  ),
);
document.querySelector('#digital-copy')!.addEventListener('click', async () => {
  try {
    const selection = new URLSearchParams({
      profils: selects.map((select) => select.value).join(','),
    });
    await navigator.clipboard.writeText(
      `${location.origin}${location.pathname}#${selection}`,
    );
    feedback.textContent = 'Lien de comparaison copié.';
  } catch {
    feedback.textContent =
      'Vous pouvez copier l’adresse depuis la barre du navigateur.';
  }
});
