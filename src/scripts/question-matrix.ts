import { el, anchor } from './ui';
export interface MatrixQuestion {
  title: string;
  href: string;
  coverage: Record<string, string>;
  alerts: Record<string, string>;
}
interface Person {
  id: string;
  name: string;
}
const labels: Record<string, string> = {
  mesure: 'Proposition',
  declaration: 'Déclaration',
  orientation: 'Orientation',
  parti: 'Texte de parti',
  revue: 'Document examiné',
  absent: 'Sans fiche',
};
export function coverageAnchor(candidate: string, kind?: string) {
  if (!candidate) return '';
  if (!kind || kind === 'absent') return 'couverture';
  return (kind === 'revue' ? 'revue-' : 'candidat-') + candidate;
}
export function questionMatrix() {
  const box = document.querySelector<HTMLDetailsElement>('#q-matrix')!;
  const table = box.querySelector('table')!;
  const rowsPerPage = 10,
    columnsPerPage = 2;
  let questionPage = 0,
    personPage = 0,
    questions: MatrixQuestion[] = [],
    people: Person[] = [];
  function pager(
    prefix: string,
    page: number,
    length: number,
    size: number,
    unit: string,
  ) {
    const first = page * size;
    box.querySelector<HTMLButtonElement>('#' + prefix + '-prev')!.disabled =
      page === 0;
    box.querySelector<HTMLButtonElement>('#' + prefix + '-next')!.disabled =
      first + size >= length;
    box.querySelector('#' + prefix + '-span')!.textContent =
      unit +
      ' ' +
      (first + 1) +
      ' à ' +
      Math.min(first + size, length) +
      ' sur ' +
      length;
  }
  function draw() {
    box.hidden = !questions.length || !people.length;
    if (box.hidden || !box.open) return;
    pager('q-m', questionPage, questions.length, columnsPerPage, 'Questions');
    pager('q-p', personPage, people.length, rowsPerPage, 'Candidats');
    const visible = questions.slice(
      questionPage * columnsPerPage,
      (questionPage + 1) * columnsPerPage,
    );
    const heading = el('tr');
    const nameHeader = el('th', 'Candidat');
    nameHeader.scope = 'col';
    heading.append(nameHeader);
    for (const q of visible) {
      const th = el('th');
      th.scope = 'col';
      th.append(anchor(q.title, q.href));
      heading.append(th);
    }
    table.tHead!.replaceChildren(heading);
    const body = table.tBodies[0];
    body.replaceChildren();
    for (const p of people.slice(
      personPage * rowsPerPage,
      (personPage + 1) * rowsPerPage,
    )) {
      const tr = el('tr'),
        th = el('th');
      th.scope = 'row';
      th.append(anchor(p.name, '/candidats/' + p.id + '/'));
      tr.append(th);
      for (const q of visible) {
        const kind = q.coverage[p.id] ?? 'absent';
        const link = anchor(
          labels[kind],
          q.href + '#' + coverageAnchor(p.id, kind),
        );
        link.dataset.kind = kind;
        link.setAttribute(
          'aria-label',
          p.name + ' · ' + labels[kind] + ' · ' + q.title,
        );
        const cell = el('td');
        cell.append(link);
        if (q.alerts[p.id]) cell.append(el('small', q.alerts[p.id]));
        tr.append(cell);
      }
      body.append(tr);
    }
  }
  box.querySelector('#q-m-prev')!.addEventListener('click', () => {
    questionPage--;
    draw();
  });
  box.querySelector('#q-m-next')!.addEventListener('click', () => {
    questionPage++;
    draw();
  });
  box.querySelector('#q-p-prev')!.addEventListener('click', () => {
    personPage--;
    draw();
  });
  box.querySelector('#q-p-next')!.addEventListener('click', () => {
    personPage++;
    draw();
  });
  box.addEventListener('toggle', draw);
  return function replace(visible: MatrixQuestion[], candidates: Person[]) {
    questions = visible;
    people = candidates;
    questionPage = 0;
    personPage = 0;
    draw();
  };
}
