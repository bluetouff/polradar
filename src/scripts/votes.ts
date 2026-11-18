const workspace = document.querySelector<HTMLElement>('[data-votes-workspace]');
if (workspace) {
  const panels = [
    ...workspace.querySelectorAll<HTMLElement>('[data-vote-case]'),
  ];
  const tabs = [
    ...workspace.querySelectorAll<HTMLAnchorElement>('[data-vote-tab]'),
  ];
  const update = () => {
    const selected = new URLSearchParams(location.hash.slice(1)).get('dossier');
    const panel =
      panels.find((p) => p.dataset.voteCase === selected) || panels[0];
    panels.forEach((p) => (p.hidden = p !== panel));
    tabs.forEach((tab) => {
      if (tab.dataset.voteTab === panel.dataset.voteCase)
        tab.setAttribute('aria-current', 'true');
      else tab.removeAttribute('aria-current');
    });
  };
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
    history.pushState(
      null,
      '',
      `#${new URLSearchParams({ dossier: tab.dataset.voteTab! })}`,
    );
    update();
  });
  window.addEventListener('hashchange', update);
  window.addEventListener('popstate', update);
  update();
}
