const workspace = document.querySelector<HTMLElement>('[data-votes-workspace]');
if (workspace) {
  const panels = [
    ...workspace.querySelectorAll<HTMLElement>('[data-vote-case]'),
  ];
  const tabs = [
    ...workspace.querySelectorAll<HTMLAnchorElement>('[data-vote-tab]'),
  ];
  const chooser =
    workspace.querySelector<HTMLSelectElement>('[data-vote-select]')!;
  const directory =
    workspace.querySelector<HTMLDetailsElement>('.dossier-directory')!;
  const update = () => {
    const selected = new URLSearchParams(location.hash.slice(1)).get('dossier');
    const panel = panels.find((p) => p.dataset.voteCase === selected);
    panels.forEach((p) => (p.hidden = p !== panel));
    chooser.value = panel?.dataset.voteCase ?? '';
    directory.open = !panel;
    tabs.forEach((tab) => {
      if (tab.dataset.voteTab === panel?.dataset.voteCase)
        tab.setAttribute('aria-current', 'true');
      else tab.removeAttribute('aria-current');
    });
  };
  const choose = (id: string) => {
    history.pushState(null, '', `#${new URLSearchParams({ dossier: id })}`);
    update();
  };
  chooser.addEventListener('change', () => choose(chooser.value));
  workspace.addEventListener('click', (event) => {
    if (
      !(event instanceof MouseEvent) ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const tab =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('[data-vote-tab]')
        : null;
    if (!tab) return;
    event.preventDefault();
    choose(tab.dataset.voteTab!);
    directory.open = false;
    panels.find((p) => !p.hidden)?.focus();
  });
  window.addEventListener('hashchange', update);
  window.addEventListener('popstate', update);
  update();
  workspace.classList.add('votes-ready');
}
