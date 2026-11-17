const controls = document.querySelector<HTMLElement>(
  '[data-candidate-controls]',
);
if (controls) {
  const query = controls.querySelector<HTMLInputElement>(
    '[data-candidate-query]',
  )!;
  const theme = controls.querySelector<HTMLSelectElement>(
    '[data-candidate-theme]',
  )!;
  const status = controls.querySelector<HTMLElement>(
    '[data-candidate-status]',
  )!;
  const cards = [
    ...document.querySelectorAll<HTMLElement>(
      '.candidate-gallery [data-search]',
    ),
  ];
  const allowed = new Set([...theme.options].map((option) => option.value));
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  const counts = new Map(
    cards.map((card) => [
      card,
      JSON.parse(card.dataset.themeCounts || '{}') as Record<string, number>,
    ]),
  );
  function update(write = true) {
    const selected = allowed.has(theme.value) ? theme.value : '';
    let visible = 0,
      documented = 0;
    for (const card of cards) {
      card.hidden = !normalize(card.dataset.search || '').includes(
        normalize(query.value.trim()),
      );
      if (!card.hidden) visible++;
      const count = selected ? counts.get(card)?.[selected] || 0 : 0;
      if (!card.hidden && count > 0) documented++;
      card.dataset.themeMatch = selected && count > 0 ? 'yes' : 'no';
      const label = card.querySelector<HTMLElement>('[data-person-count]')!;
      label.textContent = selected
        ? count
          ? `${count} fiche${count > 1 ? 's' : ''} sur ce thème`
          : 'Thème à documenter'
        : label.dataset.defaultLabel || '';
      const link = card.querySelector<HTMLAnchorElement>('[data-person-link]')!;
      link.href =
        (link.dataset.baseUrl || '/candidats/') +
        (selected && count ? '#theme-' + selected : '');
      card
        .querySelectorAll<HTMLElement>('[data-theme-cell]')
        .forEach((cell) => {
          cell.dataset.active =
            cell.dataset.themeCell === selected ? 'yes' : 'no';
        });
    }
    status.textContent = `${visible} candidature${visible > 1 ? 's' : ''}${selected ? ` · ${documented} dossier${documented > 1 ? 's' : ''} documenté${documented > 1 ? 's' : ''} sur ce thème` : ''}`;
    if (write) {
      const params = new URLSearchParams();
      if (selected) params.set('theme', selected);
      if (query.value.trim()) params.set('q', query.value.trim().slice(0, 200));
      history.replaceState(
        null,
        '',
        location.pathname + (params.size ? '#' + params : ''),
      );
    }
  }
  function restore() {
    const params = new URLSearchParams(location.hash.slice(1));
    const value = params.get('theme') || '';
    theme.value = allowed.has(value) ? value : '';
    query.value = (params.get('q') || '').slice(0, 200);
    update(false);
  }
  controls.hidden = false;
  query.addEventListener('input', () => update());
  theme.addEventListener('change', () => update());
  window.addEventListener('hashchange', restore);
  restore();
}
