import { detailDate, type Change, type ChangeState } from '../lib/follow-view';
import {
  followWindow,
  withinWindow,
  sharedChange,
} from '../lib/follow-window.mjs';
import { el, anchor } from './ui';

type Prefs = { candidates: string[]; themes: string[] };
function statePanel(side: 'before' | 'after', state: ChangeState | null) {
  const panel = el('section', undefined, 'change-side change-' + side);
  panel.append(el('h4', side === 'before' ? 'Avant' : 'Après'));
  if (!state) {
    panel.append(
      el(
        'p',
        side === 'before'
          ? 'Première inscription dans Polradar.'
          : 'Fiche retirée du corpus.',
      ),
    );
    return panel;
  }
  const info = el('dl');
  for (const field of state.fields)
    info.append(el('dt', field.label), el('dd', field.text));
  panel.append(info);
  if (state.sources.length) {
    const sources = el('details', undefined, 'change-sources'),
      list = el('ul');
    sources.append(
      el(
        'summary',
        state.sources.length > 1
          ? 'Sources (' + state.sources.length + ')'
          : 'Source',
      ),
    );
    for (const ref of state.sources) {
      const item = el('li');
      item.append(anchor(ref.label, ref.url));
      if (ref.locator) item.append(el('small', ref.locator));
      list.append(item);
    }
    sources.append(list);
    panel.append(sources);
  }
  return panel;
}
function changeCard(row: Change, names: Map<string, string>) {
  const card = el('article', undefined, 'change-card');
  const meta = el('div', undefined, 'change-meta'),
    time = el('time', detailDate(row), 'since-time');
  time.dateTime = row.at || row.day;
  meta.append(el('span', row.label, 'since-kind'), time);
  const person = names.get(row.candidate) ?? row.candidate;
  const author = row.author ? row.author + ' · dossier ' + person : person;
  card.append(
    meta,
    el('p', author, 'change-author'),
    el('h3', row.title),
    el('p', row.context, 'change-context'),
  );
  const states = el('div', undefined, 'change-states');
  states.append(
    statePanel('before', row.before),
    statePanel('after', row.after),
  );
  const links = el('div', undefined, 'change-links');
  const permalink = anchor(
    'Lien permanent',
    '/suivi/#changement=' + row.day + ':' + row.id,
  );
  permalink.setAttribute('aria-label', 'Lien permanent · ' + row.title);
  links.append(
    anchor(
      row.kind === 'agenda'
        ? 'Ouvrir le rendez-vous'
        : row.kind === 'vote'
          ? 'Consulter le scrutin'
          : row.kind === 'evolution'
            ? 'Comparer les documents'
            : 'Consulter la fiche',
      row.href,
    ),
    permalink,
  );
  card.append(states, links);
  return card;
}
export function mountChangeFeed(names: Map<string, string>) {
  const root = document.getElementById('depuis-hier')!,
    dates = root.dataset.days!.split(',').filter(Boolean);
  const cards = document.getElementById('since-cards')!,
    status = document.getElementById('since-status')!;
  const all = document.querySelector<HTMLButtonElement>('#since-all')!,
    more = document.querySelector<HTMLButtonElement>('#since-more')!,
    back = document.getElementById('since-return')!;
  const cache = new Map<string, Promise<Change[]>>();
  let prefs: Prefs = { candidates: [], themes: [] },
    period = 24,
    limit = 6,
    generation = 0,
    everyone = false;
  let shown: Change[] = [];
  const loadDay = (day: string) => {
    let data = cache.get(day);
    if (!data) {
      data = fetch('/api/suivi/' + day + '.json', {
        credentials: 'omit',
        redirect: 'error',
      })
        .then((r) => {
          if (!r.ok) throw Error('Journal indisponible');
          return r.json() as Promise<Change[]>;
        })
        .catch((err) => {
          cache.delete(day);
          throw err;
        });
      cache.set(day, data);
    }
    return data;
  };
  function appendCards(start: number) {
    cards.append(
      ...shown.slice(start, limit).map((row) => changeCard(row, names)),
    );
    more.hidden = shown.length <= limit;
  }
  async function render() {
    const turn = ++generation,
      shared = sharedChange(location.hash, dates);
    const selection = prefs.candidates.length + prefs.themes.length;
    const range = followWindow(Date.now(), period);
    cards.replaceChildren();
    shown = [];
    more.hidden = true;
    back.hidden = !shared;
    all.hidden = Boolean(shared);
    all.setAttribute('aria-pressed', String(everyone));
    all.textContent = everyone ? 'Afficher mon suivi' : 'Toute la campagne';
    for (const input of root.querySelectorAll<HTMLInputElement>(
      'input[name=since-hours]',
    ))
      input.disabled = Boolean(shared);
    if (shared && !shared.day) {
      status.textContent = 'Ce lien ne correspond à aucun changement publié.';
      return;
    }
    if (!shared && !selection && !everyone) {
      status.textContent =
        'Choisissez un candidat ou un thème, ou consultez toute la campagne.';
      return;
    }
    status.textContent = 'Chargement des changements…';
    const days = shared
      ? [shared.day as string]
      : dates.filter((day) => day >= range.first && day <= range.last);
    try {
      const rows = (await Promise.all(days.map(loadDay))).flat();
      if (turn !== generation) return;
      shown = shared
        ? rows.filter((row) => row.id === shared.id)
        : rows.filter(
            (row) =>
              withinWindow(row, range) &&
              (everyone ||
                prefs.candidates.includes(row.candidate) ||
                row.themes.some((t) => prefs.themes.includes(t))),
          );
      shown.sort(
        (a, b) =>
          b.day.localeCompare(a.day) ||
          (Date.parse(b.at ?? '') || 0) - (Date.parse(a.at ?? '') || 0) ||
          a.title.localeCompare(b.title, 'fr') ||
          a.id.localeCompare(b.id),
      );
      const count = shown.length;
      status.textContent = shared
        ? count
          ? 'Changement partagé.'
          : 'Ce changement est introuvable.'
        : (count
            ? count + ' changement' + (count > 1 ? 's' : '')
            : 'Aucun changement') +
          (everyone ? ' pour toute la campagne' : ' dans votre sélection') +
          ' sur ' +
          (period === 24
            ? 'les dernières 24 heures.'
            : 'les 7 derniers jours.');
      appendCards(0);
    } catch {
      if (turn === generation)
        status.textContent =
          'Le journal de cette période est indisponible. Rechargez la page pour réessayer.';
    }
  }
  all.addEventListener('click', () => {
    everyone = !everyone;
    limit = 6;
    void render();
  });
  more.addEventListener('click', () => {
    const previous = limit;
    limit += 6;
    appendCards(previous);
  });
  for (const input of root.querySelectorAll<HTMLInputElement>(
    'input[name=since-hours]',
  ))
    input.addEventListener('change', () => {
      period = input.value === '168' ? 168 : 24;
      limit = 6;
      void render();
    });
  const onHash = () => {
    limit = 6;
    void render();
    if (location.hash.startsWith('#changement='))
      root.scrollIntoView({ block: 'start' });
  };
  window.addEventListener('hashchange', onHash);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void render();
  });
  if (location.hash.startsWith('#changement='))
    root.scrollIntoView({ block: 'start' });
  return (value: Prefs) => {
    prefs = value;
    everyone = false;
    limit = 6;
    void render();
  };
}
