const atlas = document.querySelector<HTMLElement>('.party-atlas');
const issue = document.querySelector<HTMLSelectElement>('#issue-choice');
const person = document.querySelector<HTMLSelectElement>('#profile-choice');
const controls = document.querySelector<HTMLElement>('.issue-selectors');
const panels = Array.from(
  document.querySelectorAll<HTMLDetailsElement>('[data-issue]'),
);
function focusParty(id: string | undefined) {
  atlas
    ?.querySelectorAll<HTMLElement | SVGElement>(
      '[data-party],[data-party-row]',
    )
    .forEach((el) => {
      el.classList.toggle(
        'selected',
        Boolean(id) && (el.dataset.party ?? el.dataset.partyRow) === id,
      );
    });
  const output = atlas?.querySelector<HTMLElement>('[data-party-selection]');
  if (!output) return;
  const row =
    id && /^\d+$/.test(id) ? document.getElementById('parti-' + id) : null;
  output.hidden = !row;
  if (row) {
    const name = row.querySelector('th span')?.firstChild?.textContent?.trim();
    const family = row.querySelector('small')?.textContent;
    const values = Array.from(row.querySelectorAll('td'), (cell) =>
      cell.textContent.trim(),
    );
    output.textContent = `${name} · ${family}. Économie ${values[0]}/10 · Société ${values[1]}/10 · Europe ${values[2]}/7.`;
  }
}
atlas?.addEventListener('click', (event) => {
  if (
    !(event.target instanceof Element) ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
    return;
  const link = event.target.closest<HTMLAnchorElement | SVGAElement>(
    '[data-party],[data-choose-party]',
  );
  if (!link) return;
  event.preventDefault();
  const id = link.dataset.party ?? link.dataset.chooseParty;
  if (!id) return;
  const url = new URL(location.href);
  url.hash = 'parti-' + id;
  history.replaceState(null, '', url);
  focusParty(id);
});
atlas?.querySelector('.axis-switch')?.addEventListener('change', (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  const url = new URL(location.href);
  if (event.target.id === 'axe-europe') url.searchParams.set('axe', 'europe');
  else url.searchParams.delete('axe');
  history.pushState(null, '', url);
});
function filterIssues() {
  if (!issue || !person) return;
  for (const panel of panels) {
    const active = panel.dataset.issue === issue.value;
    panel.hidden = !active;
    panel.open = active;
    if (!active) continue;
    const balance = panel.querySelector<HTMLElement>('[data-issue-balance]');
    if (balance) balance.hidden = Boolean(person.value);
    panel
      .querySelectorAll<HTMLElement>('[data-lane-count]')
      .forEach((count) => (count.hidden = Boolean(person.value)));
    let own = 0,
      party = 0;
    for (const entry of panel.querySelectorAll<HTMLAnchorElement>(
      '[data-issue-person]',
    )) {
      const shown = !person.value || person.value === entry.dataset.issuePerson;
      entry.hidden = !shown;
      if (shown) {
        if (entry.dataset.author === 'parti') party++;
        else own++;
      }
    }
    for (const lane of panel.querySelectorAll<HTMLElement>('.issue-lane'))
      lane.hidden = !lane.querySelector('[data-issue-person]:not([hidden])');
    const note = panel.querySelector<HTMLElement>('[data-issue-missing]');
    if (note) {
      note.hidden = !person.value || own > 0;
      const name =
        person.selectedOptions[0]?.textContent ?? 'cette candidature';
      note.textContent = party
        ? `Seul le texte du parti est documenté ici pour ${name}.`
        : `Aucune position documentée sur cette question pour ${name}.`;
    }
  }
}
function restore() {
  const hash = location.hash.slice(1);
  focusParty(hash.startsWith('parti-') ? hash.slice(6) : undefined);
  if (!issue || !person) return;
  const query = new URL(location.href).searchParams;
  const axis = document.getElementById(
    query.get('axe') === 'europe' ? 'axe-europe' : 'axe-societe',
  );
  if (axis instanceof HTMLInputElement) axis.checked = true;
  for (const [select, key] of [
    [issue, 'question'],
    [person, 'candidature'],
  ] as const) {
    const value = query.get(key);
    select.value = Array.from(select.options).some((o) => o.value === value)
      ? value!
      : select.options[0].value;
  }
  filterIssues();
}
if (issue && person && controls) {
  restore();
  controls.hidden = false;
  controls.closest('section')?.classList.add('enhanced');
  controls.addEventListener('change', () => {
    const url = new URL(location.href);
    url.searchParams.set('question', issue.value);
    if (person.value) url.searchParams.set('candidature', person.value);
    else url.searchParams.delete('candidature');
    url.hash = 'issues-title';
    history.pushState(null, '', url);
    filterIssues();
  });
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', () =>
    focusParty(location.hash.match(/^#parti-(\d+)$/)?.[1]),
  );
}
