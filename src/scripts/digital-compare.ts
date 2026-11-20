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
  const slots = selects.map((_, i) => {
    const id = requested[i] || '';
    return allowed.has(id) && requested.indexOf(id) === i ? id : '';
  });
  const active = slots.filter(Boolean);
  selects.forEach((select, index) => {
    select.value = slots[index];
    for (const option of select.options)
      option.disabled =
        option.value !== select.value && active.includes(option.value);
  });
  for (const { container, cells } of rows) {
    for (const [id, cell] of cells)
      cell.hidden = active.length
        ? !active.includes(id)
        : cell.dataset.documented !== 'true';
    for (const id of active.length ? active : cells.keys())
      container.append(cells.get(id)!);
  }
  if (save) {
    const selection = new URLSearchParams({ candidats: slots.join(',') });
    history.replaceState(
      null,
      '',
      location.pathname + (active.length ? '#' + selection : ''),
    );
    feedback.textContent = 'Comparaison mise à jour.';
  }
}

function restoreSelection() {
  const hash = new URLSearchParams(location.hash.slice(1));
  render(
    (hash.get('candidats') ?? hash.get('profils') ?? '').split(','),
    false,
  );
}
restoreSelection();
window.addEventListener('hashchange', () => {
  restoreSelection();
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
    await navigator.clipboard.writeText(
      location.origin + location.pathname + location.hash,
    );
    feedback.textContent = 'Lien de comparaison copié.';
  } catch {
    feedback.textContent =
      'Vous pouvez copier l’adresse depuis la barre du navigateur.';
  }
});
