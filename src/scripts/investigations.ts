import { csvValue } from '../lib/features.mjs';
import { anchor, download, el } from './ui';
import {
  createInvestigation,
  investigations,
  keyFor,
  maxInvestigationBytes,
  parseInvestigations,
  updateInvestigations,
  type Investigation,
} from './investigations-store';

const root = document.querySelector<HTMLElement>('#investigations')!;
const status = root.querySelector<HTMLElement>('#investigations-status')!;
const name = root.querySelector<HTMLInputElement>('#new-investigation')!;
const choice = root.querySelector<HTMLSelectElement>('#investigations-choice')!;
const folder = root.querySelector<HTMLElement>('#investigation-folder')!;
const folderTitle = root.querySelector<HTMLElement>('#investigation-name')!;
const rename = root.querySelector<HTMLInputElement>('#rename-investigation')!;
const notes = root.querySelector<HTMLTextAreaElement>(
  '#investigation-notes-text',
)!;
const includeNotes = root.querySelector<HTMLInputElement>(
  '#export-investigation-notes',
)!;
const list = root.querySelector<HTMLElement>('#investigation-references')!;
const origin = 'https://polradar.fr';
let current: Investigation | undefined;

function changeNotice(error: unknown) {
  status.textContent =
    error instanceof Error && error.name === 'Error'
      ? error.message
      : 'L’opération a échoué. Vérifiez le fichier ou le stockage du navigateur.';
}
function render(rows: Investigation[], selected?: string) {
  current = rows.find(({ id }) => id === selected) ?? rows[0];
  choice.replaceChildren();
  if (!current) {
    choice.append(el('option', 'Aucun dossier'));
    choice.disabled = true;
    folder.hidden = true;
    return;
  }
  for (const dossier of rows) {
    const option = el('option', dossier.title);
    option.value = dossier.id;
    choice.append(option);
  }
  choice.value = current.id;
  choice.disabled = false;
  folder.hidden = false;
  folderTitle.textContent = rename.value = current.title;
  notes.value = current.notes;
  includeNotes.checked = false;
  list.replaceChildren();
  if (!current.items.length) {
    list.append(
      el('li', 'Ajoutez des références depuis les pages que vous consultez.'),
    );
    return;
  }
  current.items.forEach((entry, index, entries) => {
    const line = el('li');
    const link = anchor(entry.title, entry.url);
    link.rel = 'noreferrer';
    line.append(link);
    if (entry.revision)
      line.append(el('small', 'Révision ' + entry.revision.slice(0, 12)));
    const actions = el('div');
    for (const [label, shift, disabled] of [
      ['Remonter', -1, index === 0],
      ['Descendre', 1, index === entries.length - 1],
      ['Retirer', 0, false],
    ] as const) {
      const button = el('button', label, 'button small');
      button.type = 'button';
      button.disabled = disabled;
      button.setAttribute('aria-label', label + ' ' + entry.title);
      button.addEventListener(
        'click',
        () =>
          void editCurrent((dossier) => {
            const at = dossier.items.findIndex(
              (item) => keyFor(item) === keyFor(entry),
            );
            if (at < 0 || at + shift < 0 || at + shift >= dossier.items.length)
              return;
            const [item] = dossier.items.splice(at, 1);
            if (shift) dossier.items.splice(at + shift, 0, item);
          }, 'Dossier mis à jour.'),
      );
      actions.append(button);
    }
    line.append(actions);
    list.append(line);
  });
}

async function editCurrent(
  edit: (dossier: Investigation) => void,
  message: string,
) {
  const selected = current?.id;
  if (!selected) return;
  try {
    const rows = await updateInvestigations((list) => {
      const dossier = list.find(({ id }) => id === selected);
      if (!dossier) throw Error('Ce dossier a été retiré.');
      edit(dossier);
      return list;
    });
    render(rows, selected);
    status.textContent = message;
  } catch (error) {
    changeNotice(error);
  }
}

function format(dossier: Investigation, kind: string, privateNotes: boolean) {
  const itemNotes = privateNotes ? dossier.notes : '';
  const full = (url: string) => new URL(url, origin).href;
  if (kind === 'json')
    return JSON.stringify(
      { version: 1, dossiers: [{ ...dossier, notes: itemNotes }] },
      null,
      2,
    );
  if (kind === 'md') {
    const escape = (value: string) =>
      value.replace(/[\\`*_{}\[\]()#+\-.!<>~|]/g, '\\$&');
    return [
      '# ' + escape(dossier.title.replaceAll('\n', ' ')),
      '',
      ...dossier.items.map(
        (item) =>
          '- ' +
          escape(item.title.replaceAll('\n', ' ')) +
          ' · <' +
          new URL(full(item.url)).href.replace(/[<>]/g, (c) =>
            encodeURIComponent(c),
          ) +
          '>' +
          (item.revision ? ' · ' + item.revision : ''),
      ),
      ...(itemNotes
        ? ['', '## Notes personnelles', '', escape(itemNotes)]
        : []),
    ].join('\n');
  }
  if (kind === 'csv') {
    return (
      '\uFEFF' +
      [
        ['Titre', 'URL', 'Révision'],
        ...dossier.items.map((item) => [
          item.title,
          full(item.url),
          item.revision,
        ]),
        ...(itemNotes ? [['Notes personnelles', itemNotes, null]] : []),
      ]
        .map((line) => line.map(csvValue).join(';'))
        .join('\r\n')
    );
  }
  const doc = document.implementation.createHTMLDocument(dossier.title);
  doc.documentElement.lang = 'fr';
  const charset = doc.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; base-uri 'none'; form-action 'none'";
  doc.head.prepend(charset, policy);
  const heading = doc.createElement('h1');
  heading.textContent = dossier.title;
  const refs = doc.createElement('ol');
  for (const item of dossier.items) {
    const line = doc.createElement('li');
    const link = doc.createElement('a');
    link.href = full(item.url);
    link.rel = 'noreferrer';
    link.textContent = item.title;
    line.append(link, item.revision ? ' · Révision ' + item.revision : '');
    refs.append(line);
  }
  doc.body.append(heading, refs);
  if (itemNotes) {
    const text = doc.createElement('pre');
    text.textContent = itemNotes;
    doc.body.append(text);
  }
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}

choice.addEventListener('change', () => {
  try {
    render(investigations(), choice.value);
  } catch (error) {
    changeNotice(error);
  }
});
root
  .querySelector('#create-investigation')!
  .addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const dossier = createInvestigation(name.value);
      render(
        await updateInvestigations((rows) => [...rows, dossier]),
        dossier.id,
      );
      name.value = '';
      status.textContent = 'Dossier créé.';
    } catch (error) {
      changeNotice(error);
    }
  });
root
  .querySelector('#investigation-notes')!
  .addEventListener('submit', (event) => {
    event.preventDefault();
    const title = rename.value.trim();
    const text = notes.value;
    void editCurrent((dossier) => {
      dossier.title = title;
      dossier.notes = text;
    }, 'Nom et notes enregistrés.');
  });
root
  .querySelector('#delete-investigation')!
  .addEventListener('click', async () => {
    const selected = current?.id;
    if (
      !selected ||
      !window.confirm('Supprimer ce dossier et ses notes de ce navigateur ?')
    )
      return;
    try {
      render(
        await updateInvestigations((rows) =>
          rows.filter(({ id }) => id !== selected),
        ),
      );
      status.textContent = 'Dossier supprimé.';
    } catch (error) {
      changeNotice(error);
    }
  });
const types: Record<string, string> = {
  json: 'application/json',
  md: 'text/markdown',
  csv: 'text/csv',
  html: 'text/html',
};
for (const button of root.querySelectorAll<HTMLButtonElement>(
  '[data-format]',
)) {
  button.addEventListener('click', () => {
    const kind = button.dataset.format!;
    if (!current || !Object.hasOwn(types, kind)) return;
    download(
      format(current, kind, includeNotes.checked),
      types[kind] + ';charset=utf-8',
      'polradar-enquete.' + kind,
    );
  });
}
root
  .querySelector('#import-investigation')!
  .addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = root.querySelector<HTMLInputElement>('#investigation-file')!;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > maxInvestigationBytes)
        throw Error('Fichier trop volumineux.');
      const items = parseInvestigations(await file.text());
      if (!items.length) throw Error('Le fichier ne contient aucun dossier.');
      const copied = items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      }));
      render(
        await updateInvestigations((rows) => [...rows, ...copied]),
        copied[0].id,
      );
      input.value = '';
      status.textContent = 'Dossier importé dans ce navigateur.';
    } catch (error) {
      changeNotice(error);
    }
  });
root.hidden = false;
try {
  render(investigations());
} catch (error) {
  changeNotice(error);
}
