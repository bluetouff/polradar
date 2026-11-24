const workspace = document.querySelector<HTMLElement>('[data-votes-workspace]');
if (workspace) {
  const cards = new Map(
    [...workspace.querySelectorAll<HTMLAnchorElement>('[data-vote-tab]')].map(
      (card) => [card.dataset.voteTab, card],
    ),
  );
  const chooser =
    workspace.querySelector<HTMLSelectElement>('[data-vote-select]');
  const openLegacyLink = () => {
    const params = new URLSearchParams(location.hash.slice(1));
    const card = cards.get(params.get('dossier') ?? '');
    if (!card) return;
    const target = new URL(card.href);
    const ballot = params.get('scrutin');
    if (ballot && card.dataset.ballots?.split(' ').includes(ballot)) {
      target.hash = 'scrutin-' + ballot;
    }
    location.replace(target.href);
  };
  chooser?.addEventListener('change', () => {
    const card = cards.get(chooser.value);
    if (card) location.assign(card.href);
  });
  window.addEventListener('pageshow', () => {
    if (chooser) chooser.value = '';
  });
  window.addEventListener('hashchange', openLegacyLink);
  workspace.classList.add('votes-ready');
  openLegacyLink();
}
