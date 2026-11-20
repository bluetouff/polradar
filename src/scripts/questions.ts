import { normalize } from '../lib/features.mjs';

import {
  questionMatrix,
  coverageAnchor,
  type MatrixQuestion,
} from './question-matrix';

const form = document.querySelector<HTMLFormElement>('#q-filter');
if (form) {
  const search = form.querySelector<HTMLInputElement>('[name=q]')!;
  const theme = form.querySelector<HTMLSelectElement>('[name=theme]')!;
  const person = form.querySelector<HTMLSelectElement>('[name=candidat]')!;
  const coverage = form.querySelector<HTMLSelectElement>('[name=etat]')!;
  const stateLabel = document.getElementById('q-state')!;
  const status = document.getElementById('q-result')!;
  const empty = document.getElementById('q-empty')!;
  const groups = [
    ...document.querySelectorAll<HTMLDetailsElement>('.q-topic'),
  ].map((group) => ({
    group,
    items: [...group.querySelectorAll<HTMLLIElement>('li')].map((item) => ({
      item,
      text: normalize(item.dataset.search),
      people: (item.dataset.people ?? '').split(' '),
      matrix: {
        title: item.querySelector('a>span')!.textContent ?? '',
        href: item.querySelector('a')!.pathname,
        coverage: JSON.parse(item.dataset.coverage!) as Record<string, string>,
        alerts: JSON.parse(item.dataset.alerts ?? '{}') as Record<
          string,
          string
        >,
      },
      link: item.querySelector('a')!,
      count: item.querySelector<HTMLElement>('.q-count')!,
      label: item.querySelector<HTMLElement>('.q-person')!,
    })),
  }));
  const updateMatrix = questionMatrix();
  const allPeople = [...person.options]
    .filter((opt) => opt.value)
    .map((opt) => ({ id: opt.value, name: opt.text }));
  const stopWords = new Set([
    'a',
    'au',
    'aux',
    'de',
    'des',
    'du',
    'd',
    'en',
    'et',
    'l',
    'la',
    'le',
    'les',
    'un',
    'une',
  ]);
  function render(save: boolean) {
    if (!person.value) coverage.value = '';
    stateLabel.hidden = !person.value;
    const terms = normalize(search.value)
      .split(/[^a-z0-9]+/)
      .filter((word: string) => word && !stopWords.has(word));
    const active = Boolean(search.value.trim() || theme.value || person.value);
    let total = 0;
    let answers = 0;
    const visibleQuestions: MatrixQuestion[] = [];
    for (const { group, items } of groups) {
      let shown = 0;
      for (const { item, text, people, link, label, count, matrix } of items) {
        const found = people.includes(person.value);
        const matchesCoverage =
          !coverage.value ||
          (coverage.value === 'documentees' ? found : !found);
        const visible =
          (!theme.value || group.dataset.theme === theme.value) &&
          matchesCoverage &&
          terms.every((word: string) => text.includes(word));
        item.hidden = !visible;
        count.hidden = Boolean(person.value);
        label.hidden = !person.value;
        label.textContent = found
          ? 'Fiche reliée'
          : matrix.coverage[person.value] === 'revue'
            ? 'Document examiné'
            : 'Sans fiche reliée';
        label.classList.toggle('q-documented', found);
        link.hash = coverageAnchor(person.value, matrix.coverage[person.value]);
        if (visible) {
          shown++;
          visibleQuestions.push(matrix);
          if (found) answers++;
        }
      }
      group.hidden = shown === 0;
      group.open = shown > 0 && (active || location.hash === '#' + group.id);
      total += shown;
    }
    updateMatrix(
      visibleQuestions,
      person.value ? allPeople.filter((p) => p.id === person.value) : allPeople,
    );
    status.hidden = !active;
    status.textContent =
      total +
      ' question' +
      (total === 1 ? '' : 's') +
      (person.value
        ? ' · ' +
          answers +
          ' avec une fiche pour ' +
          person.selectedOptions[0].textContent
        : '');
    empty.hidden = total !== 0;
    if (save) {
      const p = new URLSearchParams();
      if (search.value.trim()) p.set('q', search.value.trim());
      if (theme.value) p.set('theme', theme.value);
      if (person.value) p.set('candidat', person.value);
      if (coverage.value) p.set('etat', coverage.value);
      history.replaceState(
        null,
        '',
        location.pathname + (p.size ? '#' + p.toString() : ''),
      );
    }
  }
  function restore() {
    const params = new URLSearchParams(location.hash.slice(1));
    search.value = (params.get('q') ?? '').slice(0, 140);
    theme.value = params.get('theme') ?? '';
    person.value = params.get('candidat') ?? '';
    coverage.value = params.get('etat') ?? '';
    render(false);
  }
  restore();
  form.hidden = false;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    render(true);
  });
  search.addEventListener('input', () => render(true));
  form.addEventListener('change', () => render(true));
  form.addEventListener('reset', () => {
    setTimeout(() => render(true), 0);
  });
  window.addEventListener('hashchange', restore);
}
