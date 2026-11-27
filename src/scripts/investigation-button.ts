import {
  createInvestigation,
  investigations,
  keyFor,
  reference,
  updateInvestigations,
} from './investigations-store';
import { savedParameters } from './saved-views';
import { el } from './ui';

const root = document.querySelector<HTMLElement>('#investigation-action')!;
const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
const form = root.querySelector<HTMLFormElement>('#investigation-add')!;
const choice = root.querySelector<HTMLSelectElement>('#investigation-choice')!;
const title = root.querySelector<HTMLInputElement>('#investigation-new-name')!;
const message = root.querySelector<HTMLElement>('#investigation-feedback')!;
const label = root.querySelector<HTMLLabelElement>(
  '[for=investigation-new-name]',
)!;
const opener = root.querySelector<HTMLButtonElement>('#investigation-open')!;
const submit = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
const renderChoice = () => {
  title.hidden = label.hidden = Boolean(choice.value);
  title.disabled = title.hidden;
  title.required = !title.hidden;
};
choice.addEventListener('change', renderChoice);
opener.addEventListener('click', () => {
  choice.replaceChildren();
  message.textContent = '';
  title.value = '';
  submit.disabled = false;
  try {
    for (const dossier of investigations()) {
      const option = el('option', dossier.title);
      option.value = dossier.id;
      choice.append(option);
    }
    const option = el('option', 'Nouveau dossier');
    option.value = '';
    choice.append(option);
  } catch {
    message.textContent =
      'Le stockage local est indisponible. Consultez vos dossiers depuis Mon suivi.';
    submit.disabled = true;
  }
  renderChoice();
  dialog.showModal();
});

root
  .querySelector('#investigation-cancel')!
  .addEventListener('click', () => dialog.close());
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  submit.disabled = true;
  try {
    const path = root.dataset.path!;
    const comparison = '#comparaison?';
    let hash = /^#version-[1-9]\d*$/.test(location.hash) ? location.hash : '';
    if (path === '/comparer/' || location.hash.startsWith(comparison)) {
      const selection = new URLSearchParams(
        path === '/comparer/' ? location.search : '',
      );
      if (location.hash.startsWith(comparison))
        for (const [key, value] of new URLSearchParams(
          location.hash.slice(comparison.length),
        ))
          selection.set(key, value);
      const saved = savedParameters('compare', selection);
      if (saved) hash = comparison + saved;
    }
    const item = reference({
      title: root.dataset.title,
      url: path + hash,
      revision: root.dataset.revision ?? null,
    });
    const chosen = choice.value;
    const name = title.value;
    await updateInvestigations((rows) => {
      const folder = chosen
        ? rows.find(({ id }) => id === chosen)
        : createInvestigation(name);
      if (!folder) throw Error('Le dossier sélectionné a été retiré.');
      if (!folder.items.some((entry) => keyFor(entry) === keyFor(item)))
        folder.items.push(item);
      return chosen ? rows : [...rows, folder];
    });
    message.textContent = 'Référence enregistrée dans ce navigateur.';
  } catch (error) {
    message.textContent =
      error instanceof Error && error.name === 'Error'
        ? error.message
        : 'La référence n’a pas pu être enregistrée.';
  } finally {
    submit.disabled = false;
  }
});
root.hidden = false;
