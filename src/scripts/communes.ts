import elections from '../data/communes-2022.json';
import {
  communeDataPath,
  communeLink,
  describeBallot,
  integerLabel,
  parseCommuneLink,
  readCommune,
  readCommuneIndex,
  searchCommunes,
  searchKey,
  vacancyLabel,
} from '../lib/communes.mjs';

const form = document.querySelector<HTMLFormElement>('#commune-search')!;
const input = document.querySelector<HTMLInputElement>('#commune-query')!;
const results = document.querySelector<HTMLUListElement>('#commune-matches')!;
const status = document.querySelector<HTMLElement>('#commune-status')!;
const permalink =
  document.querySelector<HTMLAnchorElement>('#commune-permalink')!;
const roundCards = [
  ...document.querySelectorAll<HTMLElement>('[data-commune-round]'),
];
const sizes = elections.rounds.map(({ candidates }) => candidates.length);
const preview = readCommune(
  elections.preview.record,
  String(elections.preview.record[0]),
  sizes,
);
type Entry = { code: string; name: string; key: string };
let indexRequest: Promise<Entry[]> | undefined;
let searchRevision = 0;
let reportRevision = 0;

function getIndex() {
  indexRequest ??= fetch(`${communeDataPath}index.json`)
    .then((response) => {
      if (!response.ok) throw new Error('Index indisponible');
      return response.json();
    })
    .then((data: unknown) => {
      const index = readCommuneIndex(data);
      if (index.length !== elections.count) throw new Error('Index incomplet');
      return index.map(([code, name]) => ({
        code,
        name,
        key: searchKey(name),
      }));
    })
    .catch((error: unknown) => {
      indexRequest = undefined;
      throw error;
    });
  return indexRequest;
}

function updateText(
  selector: string,
  text: string,
  root: ParentNode = document,
) {
  root.querySelector(selector)!.textContent = text;
}

function showReport(name: string, record: ReturnType<typeof readCommune>) {
  const [code, first, final, context] = record;
  const panels = [first, final].map((counts, index) =>
    describeBallot(counts, elections.rounds[index].candidates),
  );
  updateText('#commune-code', code);
  updateText('#commune-name', name);
  permalink.href = communeLink(code);
  const territory =
    document.querySelector<HTMLAnchorElement>('#commune-territory');
  if (territory)
    territory.href = context
      ? '/territoires/' + communeLink(code)
      : '/territoires/';
  for (const [index, card] of roundCards.entries()) {
    const panel = panels[index];
    updateText('[data-participation]', panel.participants, card);
    card
      .querySelector('[data-ballot-width]')!
      .setAttribute('width', String(panel.width));
    for (const field of [
      'registered',
      'voters',
      'abstained',
      'expressed',
      'blank',
      'invalid',
    ] as const)
      updateText(`[data-total="${field}"]`, integerLabel(panel[field]), card);
    card.querySelector<HTMLElement>('[data-expressed]')!.hidden =
      panel.expressed === 0;
    card.querySelector<HTMLElement>('[data-no-expressed]')!.hidden =
      panel.expressed > 0;
    const more = card.querySelector<HTMLDetailsElement>('details');
    if (more) more.open = false;
    [...card.querySelectorAll('[data-candidate-result]')].forEach(
      (row, position) => {
        const candidate = panel.candidates[position];
        updateText('[data-candidate-name]', candidate.name, row);
        updateText('[data-candidate-score]', candidate.score, row);
        updateText(
          '[data-candidate-votes]',
          `${integerLabel(candidate.count)} voix`,
          row,
        );
        row
          .querySelector('[data-candidate-width]')!
          .setAttribute('width', String(candidate.width));
      },
    );
  }
  document.querySelector<HTMLElement>('#commune-context-values')!.hidden =
    context === null;
  document.querySelector<HTMLElement>('#commune-context-unavailable')!.hidden =
    context !== null;
  updateText('#commune-population', context ? integerLabel(context[0]) : '');
  updateText(
    '#commune-vacancy',
    context ? vacancyLabel(context[2], context[1]) : '',
  );
}

async function loadReport() {
  const revision = ++reportRevision;
  searchRevision++;
  results.hidden = true;
  const code = parseCommuneLink(location.hash);
  if (!code || code === preview[0]) {
    showReport(elections.preview.name, preview);
    status.textContent = code
      ? `Résultats affichés · ${elections.preview.name} (${code}).`
      : location.hash.startsWith('#commune=')
        ? 'Le lien de cette commune est incomplet.'
        : '';
    return;
  }
  status.textContent = 'Chargement des résultats…';
  try {
    const entry = (await getIndex()).find((item) => item.code === code);
    if (revision !== reportRevision) return;
    if (!entry) {
      status.textContent =
        'Ce code Insee ne figure pas dans les résultats communaux de 2022.';
      return;
    }
    const response = await fetch(
      `${communeDataPath}${entry.code.slice(0, 2)}.json`,
    );
    if (!response.ok) throw new Error('Résultats indisponibles');
    const data: unknown = await response.json();
    if (revision !== reportRevision) return;
    if (!Array.isArray(data)) throw new Error('Fichier communal invalide');
    const record = readCommune(
      data.find((item) => Array.isArray(item) && item[0] === entry.code),
      entry.code,
      sizes,
    );
    showReport(entry.name, record);
    status.textContent = `Résultats affichés · ${entry.name} (${entry.code}).`;
  } catch {
    if (revision === reportRevision)
      status.textContent =
        'Les résultats de cette commune sont momentanément indisponibles.';
  }
}

function selectCommune(code: string) {
  const hash = communeLink(code);
  if (location.hash === hash) void loadReport();
  else location.hash = hash;
}

async function search(submitted: boolean) {
  const revision = ++searchRevision;
  const query = searchKey(input.value);
  results.hidden = true;
  if (query.length < 2) {
    status.textContent = submitted ? 'Saisissez au moins deux caractères.' : '';
    return;
  }
  status.textContent = 'Recherche…';
  try {
    const matches = searchCommunes(await getIndex(), query);
    if (revision !== searchRevision) return;
    const exact = matches.filter(
      ({ code, key }) => code.toLowerCase() === query || key === query,
    );
    const single =
      exact.length === 1
        ? exact[0]
        : matches.length === 1
          ? matches[0]
          : undefined;
    if (submitted && single) {
      selectCommune(single.code);
      return;
    }
    results.replaceChildren(
      ...matches.map(({ code, name }) => {
        const listItem = document.createElement('li');
        const link = document.createElement('a');
        const identifier = document.createElement('span');
        link.href = communeLink(code);
        link.append(name);
        identifier.textContent = code;
        link.append(identifier);
        link.addEventListener('click', (event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
          event.preventDefault();
          input.focus();
          selectCommune(code);
        });
        listItem.append(link);
        return listItem;
      }),
    );
    results.hidden = matches.length === 0;
    status.textContent = matches.length
      ? 'Choisissez une commune.'
      : 'Aucune commune trouvée.';
  } catch {
    if (revision === searchRevision)
      status.textContent =
        'Le répertoire des communes est momentanément indisponible.';
  }
}

form.hidden = false;
document.querySelector<HTMLElement>('#commune-examples')!.hidden = false;
permalink.hidden = false;
input.addEventListener('input', () => void search(false));
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void search(true);
});
window.addEventListener('hashchange', () => {
  if (!location.hash || location.hash.startsWith('#commune='))
    void loadReport();
});
if (location.hash.startsWith('#commune=')) void loadReport();
