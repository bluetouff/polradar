import { corpus, el, anchor, icon, measureCard } from './ui';
import { safePreferences } from '../lib/features.mjs';
const key = 'polradar.follow.v1';
async function start() {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-follow-kind]'),
  );
  const app = document.querySelector('#follow-app');
  if (!buttons.length && !app) return;
  const data = await corpus(),
    candidateIds = data.candidates.map((row) => row.id),
    themeIds = data.themes.map((row) => row.id);
  let raw = '';
  let available = true;
  try {
    raw = localStorage.getItem(key) || '';
  } catch {
    available = false;
  }
  let prefs = safePreferences(raw, candidateIds, themeIds);
  let previousVisit = prefs.lastVisit;
  const status = document.querySelector<HTMLElement>('#follow-status');
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(prefs));
      return true;
    } catch {
      available = false;
      return false;
    }
  }
  function render() {
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
        `${active ? 'Ne plus suivre' : 'Suivre'} : ${button.dataset.followName}`,
      );
    }
    if (!app) return;
    const rows = data.measures.filter(
      (measure) =>
        prefs.candidates.includes(measure.candidate) ||
        prefs.themes.includes(measure.theme),
    );
    const result = document.querySelector<HTMLElement>('#follow-results')!,
      feeds = document.querySelector<HTMLElement>('#follow-feeds')!;
    const updates = data.versions.filter(
      (version) =>
        version.recordedAt &&
        previousVisit &&
        Date.parse(version.recordedAt) > Date.parse(previousVisit) &&
        rows.some((measure) => measure.id === version.measureId),
    );
    result.replaceChildren(
      ...rows.map((measure) => measureCard(measure, data, true)),
    );
    if (!rows.length)
      result.append(el('p', 'Sélectionnez un candidat ou un thème.', 'notice'));
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
      render();
    });
  document.querySelector('#follow-clear')?.addEventListener('click', () => {
    prefs = { candidates: [], themes: [], lastVisit: null };
    previousVisit = null;
    let failed = false;
    try {
      localStorage.removeItem(key);
    } catch {
      available = false;
      failed = true;
    }
    render();
    if (failed && status)
      status.textContent =
        'L’effacement du stockage a échoué. Effacez les données du site dans les réglages de votre navigateur.';
  });
  render();
  if (app) {
    prefs.lastVisit = new Date().toISOString();
    if (!save()) render();
  }
}
start().catch(() => {
  document
    .querySelectorAll<HTMLButtonElement>('[data-follow-kind]')
    .forEach((button) => {
      button.disabled = true;
      button.title = 'Suivi indisponible. Les flux RSS restent accessibles.';
    });
  const status = document.querySelector('#follow-status');
  if (status)
    status.textContent =
      'Le suivi n’a pas pu être chargé. Les dossiers et les flux RSS restent accessibles.';
});
