import { normalize } from '../lib/features.mjs';
import { el } from './ui';

function words(text: string) {
  return normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

// A single insertion, deletion, substitution or adjacent transposition.
function oneTypo(query: string, name: string) {
  if (Math.abs(query.length - name.length) > 1) return false;
  let index = 0;
  while (index < query.length && query[index] === name[index]) index++;
  if (query.length < name.length)
    return query.slice(index) === name.slice(index + 1);
  if (query.length > name.length)
    return query.slice(index + 1) === name.slice(index);
  return (
    query.slice(index + 1) === name.slice(index + 1) ||
    (query[index] === name[index + 1] &&
      query[index + 1] === name[index] &&
      query.slice(index + 2) === name.slice(index + 2))
  );
}

function wordScore(query: string, name: string) {
  if (query === name) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  return query.length >= 4 && oneTypo(query, name) ? 3 : Infinity;
}

function nameScore(query: string[], name: string) {
  const nameWords = words(name);
  if (query.join(' ') === nameWords.join(' ')) return -1;
  return query.reduce(
    (total, word) =>
      total +
      Math.min(...nameWords.map((nameWord) => wordScore(word, nameWord))),
    0,
  );
}

export function initializeCandidateSearch(selects: HTMLSelectElement[]) {
  const dialog = document.querySelector<HTMLDialogElement>(
    '#compare-candidate-dialog',
  )!;
  if (typeof dialog.showModal !== 'function') return;
  const input = dialog.querySelector<HTMLInputElement>(
    '#compare-candidate-search',
  )!;
  const title = dialog.querySelector<HTMLElement>(
    '#compare-candidate-dialog-title',
  )!;
  const count = dialog.querySelector<HTMLElement>('#compare-candidate-count')!;
  const results = dialog.querySelector<HTMLUListElement>(
    '#compare-candidate-results',
  )!;
  let activeSelect: HTMLSelectElement | undefined;
  let returnFocus: HTMLElement | undefined;

  function renderResults() {
    if (!activeSelect) return;
    const select = activeSelect;
    const query = words(input.value.slice(0, input.maxLength));
    const matches = Array.from(select.options)
      .filter((option) => option.value && !option.disabled)
      .map((option) => ({
        option,
        score: nameScore(query, option.dataset.name ?? option.text),
      }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) => a.score - b.score);

    const rows = matches.map(({ option }) => {
      const item = el('li');
      const choice = el('button', option.label);
      choice.type = 'button';
      choice.addEventListener('click', () => {
        if (option.disabled) return;
        returnFocus = select;
        select.value = option.value;
        dialog.close();
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      item.append(choice);
      return item;
    });
    results.replaceChildren(...rows);
    results.scrollTop = 0;
    count.textContent = rows.length
      ? `${rows.length} candidature${rows.length === 1 ? '' : 's'}`
      : 'Aucune candidature trouvée';
  }

  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
      return;
    }
    if (event.key !== 'ArrowDown') return;
    const first = results.querySelector('button');
    if (!first) return;
    event.preventDefault();
    first.focus();
  });
  dialog.addEventListener('close', () => {
    returnFocus?.focus();
    activeSelect = undefined;
    returnFocus = undefined;
  });

  selects.forEach((select, index) => {
    const trigger = select.parentElement!.querySelector<HTMLButtonElement>(
      '.compare-person-search',
    )!;
    trigger.addEventListener('click', () => {
      activeSelect = select;
      returnFocus = trigger;
      title.textContent = `Chercher la candidature ${index + 1}`;
      input.value = '';
      renderResults();
      dialog.showModal();
    });
    trigger.hidden = false;
  });
}
