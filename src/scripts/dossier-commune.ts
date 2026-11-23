import {
  communeDataPath,
  updateCommuneIndex,
  searchKey,
  searchCommunes,
  parseCommuneLink,
  communeLink,
} from '../lib/communes.mjs';
import {
  localFacts,
  type Indicator,
  type Sru,
} from '../lib/dossiers-territoriaux';
import { sruPicture, sruImageUrl, sruEmbedCode } from '../lib/sru-graph';
type Commune = { code: string; name: string; key: string };
async function loadFile(url: string) {
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw Error('Édition indisponible');
  return response.json();
}
function start(root: HTMLElement) {
  const mode = root.dataset.territory as Indicator;
  const form = root.querySelector<HTMLFormElement>('[data-form]')!,
    input = form.querySelector('input')!;
  const matches = root.querySelector<HTMLUListElement>('#territory-matches')!,
    feedback = root.querySelector<HTMLElement>('[data-feedback]')!;
  const place = root.querySelector<HTMLElement>('[data-place]')!,
    facts = root.querySelector<HTMLElement>('[data-facts]')!,
    result = root.querySelector<HTMLElement>('.terrain-result')!;
  const copy = root.querySelector<HTMLButtonElement>('[data-copy]');
  const known = () =>
    Promise.all([
      loadFile(communeDataPath + 'index.json'),
      loadFile(root.dataset.names!),
    ]).then(([baseline, changes]) =>
      updateCommuneIndex(baseline, changes).map(([code, name]) => ({
        code,
        name,
        key: searchKey(name),
      })),
    );
  let directory: ReturnType<typeof known> | undefined,
    observations: Promise<Record<string, number | Sru>> | undefined;
  function names() {
    return (directory ??= known().catch((error) => {
      directory = undefined;
      throw error;
    }));
  }
  function values() {
    return (observations ??= loadFile(root.dataset.values!).catch((error) => {
      observations = undefined;
      throw error;
    }));
  }
  let sequence = 0;
  function clear() {
    matches.replaceChildren();
    matches.hidden = true;
  }
  function statusError() {
    feedback.textContent =
      'Chargement impossible. Vous pouvez relancer la recherche ou consulter le fichier officiel.';
  }
  async function show(code: string) {
    const seq = ++sequence;
    clear();
    try {
      const [list, data] = await Promise.all([names(), values()]);
      if (seq !== sequence) return;
      const entry = list.find((e) => e.code === code);
      if (!entry) {
        result.hidden = true;
        feedback.textContent = 'Code Insee absent de cet annuaire.';
        return;
      }
      const record = Object.hasOwn(data, code) ? data[code] : undefined;
      const fragment = document.createDocumentFragment();
      for (const [label, val] of localFacts(mode, code, record)) {
        const div = document.createElement('div'),
          dt = document.createElement('dt'),
          dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = val;
        div.append(dt, dd);
        fragment.append(div);
      }
      const small = document.createElement('small');
      small.textContent = code;
      place.replaceChildren(document.createTextNode(entry.name + ' '), small);
      facts.replaceChildren(fragment);
      const figure = root.querySelector<HTMLElement>('[data-local-figure]');
      if (figure) {
        figure.hidden = typeof record !== 'object' || record === null;
        if (record && typeof record === 'object') {
          const { svg, alt } = sruPicture(entry.name, code, record),
            url = sruImageUrl(svg);
          const img = figure.querySelector('img')!,
            download = figure.querySelector('a')!,
            textarea = figure.querySelector('textarea')!;
          img.src = url;
          img.alt = alt;
          download.href = url;
          download.download = 'polradar-sru-' + code + '.svg';
          textarea.value = sruEmbedCode(entry.name, code, record);
        }
      }
      result.hidden = false;
      input.value = entry.name;
      feedback.textContent =
        'Résultats affichés pour ' + entry.name + ' (' + code + ').';
    } catch {
      if (seq === sequence) {
        result.hidden = true;
        statusError();
      }
    }
  }
  function choose(entry: Commune) {
    const hash = communeLink(entry.code);
    if (location.hash !== hash) location.hash = hash;
    else void show(entry.code);
    input.focus();
  }
  async function search(submit: boolean) {
    const seq = ++sequence,
      query = searchKey(input.value);
    clear();
    feedback.textContent = '';
    if (query.length < 2) {
      if (submit) feedback.textContent = 'Saisissez au moins deux caractères.';
      return;
    }
    try {
      const items = searchCommunes(await names(), query);
      if (seq !== sequence) return;
      if (submit && items.length === 1) {
        choose(items[0]);
        return;
      }
      const exact = items.filter(
        (e) => e.code.toLowerCase() === query || e.key === query,
      );
      if (submit && exact.length === 1) {
        choose(exact[0]);
        return;
      }
      if (!items.length) {
        feedback.textContent = 'Aucune commune trouvée pour cette recherche.';
        return;
      }
      for (const item of items) {
        const li = document.createElement('li'),
          button = document.createElement('button');
        button.type = 'button';
        button.textContent = item.name + ' · ' + item.code;
        button.addEventListener('click', () => choose(item));
        li.append(button);
        matches.append(li);
      }
      matches.hidden = false;
      feedback.textContent = 'Communes proposées : ' + items.length + '.';
    } catch {
      if (seq === sequence) statusError();
    }
  }
  form.hidden = false;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void search(true);
  });
  input.addEventListener('input', () => void search(false));
  copy?.addEventListener('click', async () => {
    const field = root.querySelector('textarea')!;
    try {
      await navigator.clipboard.writeText(field.value);
      feedback.textContent = 'Code copié.';
    } catch {
      field.select();
      feedback.textContent = 'Le code est sélectionné pour la copie.';
    }
  });
  if (copy) copy.hidden = false;
  window.addEventListener('hashchange', () => {
    const code = parseCommuneLink(location.hash);
    if (code) void show(code);
    else if (!location.hash) void show('75056');
  });
  const initial = parseCommuneLink(location.hash);
  if (initial) void show(initial);
}
document.querySelectorAll<HTMLElement>('[data-territory]').forEach(start);
