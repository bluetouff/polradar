import { proposalComparison } from '../lib/proposal-view.mjs';

const evolution = document.querySelector<HTMLElement>('[data-evolution]');
const financing = document.querySelector<HTMLElement>('[data-financing]');
const root = evolution || financing;
if (root) {
  const key = evolution ? 'dossier' : 'carte';
  const sections = [
    ...root.querySelectorAll<HTMLElement>(
      evolution ? '[data-evolution-dossier]' : '[data-financing-map]',
    ),
  ];
  const tabs = [
    ...root.querySelectorAll<HTMLAnchorElement>('[data-evidence-tab]'),
  ];
  const chooser = root.querySelector<HTMLSelectElement>(
    '[data-evidence-select]',
  );
  const idOf = (section: HTMLElement) =>
    section.dataset.evolutionDossier || section.dataset.financingMap || '';
  const update = () => {
    const params = new URLSearchParams(location.hash.slice(1));
    const selected =
      sections.find((s) => idOf(s) === params.get(key)) || sections[0];
    sections.forEach((s) => (s.hidden = s !== selected));
    if (chooser) chooser.value = idOf(selected);
    tabs.forEach((t) => {
      if (t.dataset.evidenceTab === idOf(selected))
        t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
    });
    if (evolution) {
      const from =
        selected.querySelector<HTMLSelectElement>('[data-state-from]')!;
      const to = selected.querySelector<HTMLSelectElement>('[data-state-to]')!;
      from.value = [...from.options].some((o) => o.value === params.get('de'))
        ? params.get('de')!
        : from.options[0].value;
      to.value = [...to.options].some((o) => o.value === params.get('a'))
        ? params.get('a')!
        : to.options[to.options.length - 1].value;
      const cards = [
        ...selected.querySelectorAll<HTMLElement>('[data-proposal-state]'),
      ];
      cards.forEach(
        (c) =>
          (c.hidden =
            c.dataset.proposalState !== from.value &&
            c.dataset.proposalState !== to.value),
      );
      const state = (id: string) => {
        const c = cards.find((c) => c.dataset.proposalState === id)!;
        return {
          id,
          value: Number(c.dataset.value),
          unit: c.dataset.unit!,
          basisKey: c.dataset.basis!,
        };
      };
      selected.querySelector('[data-comparison-label]')!.textContent =
        proposalComparison(
          { kind: selected.dataset.kind },
          state(from.value),
          state(to.value),
        ).label;
      selected
        .querySelectorAll<HTMLAnchorElement>('[data-state-jump]')
        .forEach((a) =>
          a.classList.toggle(
            'is-compared',
            [from.value, to.value].includes(a.dataset.stateJump!),
          ),
        );
    }
  };
  const navigate = (params: URLSearchParams) => {
    history.replaceState(
      null,
      '',
      `${location.pathname}${location.search}#${params}`,
    );
    update();
  };
  root.addEventListener('change', (event) => {
    const control = event.target;
    if (!(control instanceof HTMLSelectElement)) return;
    if (control === chooser) {
      navigate(new URLSearchParams({ [key]: control.value }));
      return;
    }
    const section = control.closest<HTMLElement>('[data-evolution-dossier]');
    if (!section) return;
    navigate(
      new URLSearchParams({
        dossier: idOf(section),
        de: section.querySelector<HTMLSelectElement>('[data-state-from]')!
          .value,
        a: section.querySelector<HTMLSelectElement>('[data-state-to]')!.value,
      }),
    );
  });
  root.addEventListener('click', (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<Element>('a')
        : null;
    if (
      !target ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const tab = target.getAttribute('data-evidence-tab');
    if (tab) {
      event.preventDefault();
      navigate(new URLSearchParams({ [key]: tab }));
      return;
    }
    const jump = target.getAttribute('data-state-jump');
    if (jump) {
      event.preventDefault();
      const section = target.closest<HTMLElement>('[data-evolution-dossier]')!;
      const from =
        section.querySelector<HTMLSelectElement>('[data-state-from]')!;
      navigate(
        new URLSearchParams({
          dossier: idOf(section),
          de: from.value,
          a: jump,
        }),
      );
      return;
    }
    if (
      target.hasAttribute('data-flow-node') ||
      target.closest('.financing-flow')
    ) {
      const section = target.closest<HTMLElement>('[data-financing-map]')!;
      const details =
        section.querySelector<HTMLDetailsElement>('.finance-source')!;
      event.preventDefault();
      details.open = true;
      const index = target.getAttribute('data-flow-node');
      section
        .querySelectorAll('[data-flow-node]')
        .forEach((n) =>
          n.classList.toggle(
            'flow-selected',
            n.getAttribute('data-flow-node') === index,
          ),
        );
      const text =
        target.getAttribute('aria-label') || target.textContent?.trim();
      if (text)
        section.querySelector('[data-flow-selection]')!.textContent =
          text.replace('. Consulter la source', '');
      details.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
  root.classList.add('evidence-ready');
  addEventListener('hashchange', update);
  update();
}
