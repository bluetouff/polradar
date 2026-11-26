import { corpus, publicData, el, anchor, icon, measureCard } from './ui';
import { safePreferences } from '../lib/features.mjs';
import {
  clearSavedViews,
  readSavedViews,
  removeSavedView,
  savedViewLink,
  savedViewsKey,
} from './saved-views';

const key = 'polradar.follow.v1';

function mountSavedViews(clearButton: HTMLButtonElement) {
  const section = document.querySelector<HTMLElement>('#saved-views')!;
  const title = document.querySelector<HTMLElement>('#saved-views-title')!;
  const list = document.querySelector<HTMLUListElement>('#saved-views-list')!;
  const status = document.querySelector<HTMLElement>('#saved-views-status')!;

  function render() {
    list.replaceChildren();
    status.textContent = '';
    try {
      const views = readSavedViews();
      section.hidden = !views.length;
      for (const view of views) {
        const item = el('li');
        const link = anchor(view.title, savedViewLink(view));
        link.prepend(
          el('span', view.kind === 'search' ? 'Recherche' : 'Comparaison'),
        );
        const button = el('button', 'Retirer', 'button small');
        button.type = 'button';
        button.setAttribute('aria-label', 'Retirer ' + view.title);
        button.addEventListener('click', async () => {
          if (button.disabled) return;
          button.disabled = true;
          try {
            await removeSavedView(view);
            render();
            if (section.hidden) clearButton.focus();
            else {
              title.focus();
              status.textContent = 'Sélection retirée.';
            }
          } catch {
            status.textContent =
              'La sélection est toujours enregistrée. Réessayez.';
            button.disabled = false;
            button.focus();
          }
        });
        item.append(link, button);
        list.append(item);
      }
    } catch {
      section.hidden = false;
      status.textContent =
        'Le stockage local des recherches et comparaisons est indisponible.';
    }
  }
  window.addEventListener('storage', (event) => {
    if (event.key === savedViewsKey || event.key === null) render();
  });
  render();
  return render;
}
async function start() {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-follow-kind]'),
  );
  const app = document.querySelector('#follow-app');
  if (!buttons.length && !app) return;
  const status = document.querySelector<HTMLElement>('#follow-status');
  const clear = document.querySelector<HTMLButtonElement>('#follow-clear');
  let resetFollow: ((failed: boolean) => void) | undefined;
  if (app && clear) {
    const renderSavedViews = mountSavedViews(clear);
    clear.disabled = false;
    clear.addEventListener('click', async () => {
      let failed = false;
      try {
        localStorage.removeItem(key);
      } catch {
        failed = true;
      }
      try {
        await clearSavedViews();
      } catch {
        failed = true;
      }
      resetFollow?.(failed);
      renderSavedViews();
      if (failed && status)
        status.textContent =
          'L’effacement du stockage a échoué. Effacez les données du site dans les réglages de votre navigateur.';
    });
  }
  const choices = await publicData<{ candidates: string[]; themes: string[] }>(
    '/data/choix-suivi.json',
  );
  let raw = '';
  let available = true;
  try {
    raw = localStorage.getItem(key) || '';
  } catch {
    available = false;
  }
  let prefs = safePreferences(raw, choices.candidates, choices.themes);
  let previousVisit = prefs.lastVisit;
  let generation = 0;
  let updateFeed:
    | ((preferences: { candidates: string[]; themes: string[] }) => void)
    | undefined;
  if (app)
    void import('./follow-since')
      .then(({ mountChangeFeed }) => {
        const names = new Map(
          buttons
            .filter((button) => button.dataset.followKind === 'candidate')
            .map((button) => [
              button.dataset.followId!,
              button.dataset.followName!,
            ]),
        );
        updateFeed = mountChangeFeed(names);
        updateFeed(prefs);
      })
      .catch(() => {
        const notice = document.getElementById('since-status');
        if (notice)
          notice.textContent = 'Le journal des changements est indisponible.';
      });
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(prefs));
      return true;
    } catch {
      available = false;
      return false;
    }
  }
  async function render() {
    const turn = ++generation;
    for (const button of buttons) {
      button.disabled = false;
      const kind =
          button.dataset.followKind === 'candidate' ? 'candidates' : 'themes',
        id = button.dataset.followId!;
      const active = prefs[kind].includes(id);
      button.setAttribute('aria-pressed', String(active));
      const span = button.querySelector('span')!;
      span.textContent = active
        ? available
          ? 'Suivi activé'
          : 'Suivi temporaire'
        : `Suivre ${kind === 'candidates' ? 'ce candidat' : 'ce thème'}`;
      button.setAttribute(
        'aria-label',
        `${span.textContent} · ${button.dataset.followName}`,
      );
    }
    if (!app) return;
    updateFeed?.(prefs);
    const result = document.querySelector<HTMLElement>('#follow-results')!,
      feeds = document.querySelector<HTMLElement>('#follow-feeds')!;
    if (!prefs.candidates.length && !prefs.themes.length) {
      result.replaceChildren(
        el('p', 'Sélectionnez un candidat ou un thème.', 'notice'),
      );
      feeds.replaceChildren(
        el('p', 'Les flux apparaîtront selon votre sélection.'),
      );
      if (status)
        status.textContent = available
          ? '0 fiche dans votre suivi'
          : 'Le stockage local est indisponible. Votre sélection fonctionne pour cette page uniquement.';
      return;
    }
    let data;
    if (status) status.textContent = 'Chargement des fiches suivies…';
    try {
      data = await corpus();
    } catch {
      if (turn === generation && status)
        status.textContent =
          'Les fiches suivies sont indisponibles. Réessayez en rechargeant cette page.';
      return;
    }
    if (turn !== generation) return;
    const rows = data.measures.filter(
      (measure) =>
        prefs.candidates.includes(measure.candidate) ||
        prefs.themes.includes(measure.theme),
    );
    const selectedMeasureIds = new Set(rows.map(({ id }) => id));
    const updates = data.versions.filter(
      (version) =>
        version.recordedAt &&
        previousVisit &&
        Date.parse(version.recordedAt) > Date.parse(previousVisit) &&
        selectedMeasureIds.has(version.measureId),
    );
    result.replaceChildren(
      ...rows.map((measure) => measureCard(measure, data, true)),
    );
    if (!rows.length)
      result.append(
        el('p', 'Aucune fiche disponible pour votre sélection.', 'notice'),
      );
    feeds.replaceChildren();
    for (const [kind, ids] of [
      ['candidats', prefs.candidates],
      ['themes', prefs.themes],
    ] as const) {
      for (const id of ids) {
        const name =
          kind === 'candidats'
            ? data.candidates.find((row) => row.id === id)!.name
            : data.themes.find((row) => row.id === id)!.label;
        const link = anchor(name, `/rss/${kind}/${id}.xml`);
        link.prepend(icon('rss'));
        feeds.append(link);
      }
    }
    if (status)
      status.textContent = available
        ? `${rows.length} fiche${rows.length > 1 ? 's' : ''} dans votre suivi${previousVisit ? ` · ${updates.length} modification${updates.length > 1 ? 's' : ''} depuis votre dernière visite` : ''}`
        : 'Le stockage local est indisponible. Votre sélection fonctionne pour cette page uniquement.';
  }
  for (const button of buttons)
    button.addEventListener('click', () => {
      const kind =
          button.dataset.followKind === 'candidate' ? 'candidates' : 'themes',
        id = button.dataset.followId!;
      prefs[kind] = prefs[kind].includes(id)
        ? prefs[kind].filter((value: string) => value !== id)
        : [...prefs[kind], id];
      save();
      void render();
    });
  resetFollow = (failed) => {
    prefs = { candidates: [], themes: [], lastVisit: null };
    previousVisit = null;
    if (failed) available = false;
    void render();
  };
  void render();
  if (app && !location.hash.startsWith('#changement=')) {
    prefs.lastVisit = new Date().toISOString();
    if (!save()) void render();
  }
}
start().catch(() => {
  document
    .querySelectorAll<HTMLButtonElement>('[data-follow-kind]')
    .forEach((button) => {
      button.disabled = true;
      button.title = 'Suivi indisponible. Les flux RSS restent accessibles.';
    });
  const journal = document.getElementById('since-status');
  if (journal)
    journal.textContent = 'Le journal des changements est indisponible.';
  const status = document.querySelector('#follow-status');
  if (status)
    status.textContent =
      'Le suivi n’a pas pu être chargé. Les dossiers et les flux RSS restent accessibles.';
});
