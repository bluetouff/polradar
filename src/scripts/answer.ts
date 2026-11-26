import { isPublicSourceUrl } from '../lib/source-url.mjs';
import { anchor, date, el, number } from './ui';

const form = document.querySelector<HTMLFormElement>('#answer-form')!;
const input = document.querySelector<HTMLInputElement>('#answer-question')!;
const submit = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
const notice = document.querySelector<HTMLElement>('#answer-progress')!;
const panel = document.querySelector<HTMLElement>('#answer-panel')!;
const heading = document.querySelector<HTMLElement>('#answer-title')!;
const explanation = document.querySelector<HTMLElement>('#answer-explanation')!;
const results = document.querySelector<HTMLOListElement>('#answer-results')!;
const paths = document.querySelector<HTMLElement>('#answer-paths')!;
const coverage =
  document.querySelector<HTMLDetailsElement>('#answer-coverage')!;
const scope = document.querySelector<HTMLElement>('#answer-scope')!;
const correction =
  document.querySelector<HTMLAnchorElement>('#answer-correction')!;
const search = document.querySelector<HTMLAnchorElement>('#answer-search')!;

const site = 'https://polradar.fr';
const statusTitles: Record<string, string> = {
  documente: 'Documents retrouvés',
  partiel: 'Réponse partielle',
  'sans-resultat': 'Aucun document retrouvé',
  ambigu: 'Question à préciser',
  'hors-perimetre': 'Question hors du corpus',
};
const scopeNames: Record<string, string> = {
  campagne: 'Proposition de campagne',
  parti: 'Proposition de parti',
  orientation: 'Orientation',
  archive: 'Archive',
};
const dateNames: Record<string, string> = {
  consultation: 'Consulté le',
  publication: 'Publié le',
  scrutin: 'Scrutin du',
  observation: 'Observé le',
};
const relationNames: Record<string, string> = {
  reponse: 'Réponse à la question',
  complement: 'Complément de contexte',
};
const comparisonStates: Record<string, string> = {
  'non-documente': 'Position non documentée',
  'complement-seul': 'Complément de contexte uniquement',
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function rows(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}
function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}
function labelFor(labels: Record<string, string>, value: unknown) {
  const key = text(value);
  return Object.hasOwn(labels, key) ? labels[key] : '';
}
function dayText(value: unknown) {
  const label = text(value);
  const time = Date.parse(label);
  return /^\d{4}-\d{2}-\d{2}$/.test(label) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === label
    ? date(label)
    : label;
}

function documentLink(label: string, value: unknown, official = false) {
  const raw = text(value);
  const localPath =
    raw.startsWith('/') &&
    !raw.startsWith('//') &&
    raw.length <= 1500 &&
    /^[^\u0000-\u0020\u007f\\]+$/.test(raw);
  if (!localPath && !isPublicSourceUrl(raw)) return null;
  const url = new URL(raw, site);
  if (url.origin === site) {
    if (url.pathname.startsWith('//')) return null;
    return anchor(label, url.pathname + url.search + url.hash);
  }
  if (!official) return null;
  const link = anchor(label + ' ↗', url.href);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function renderSource(source: Record<string, unknown>, id: string) {
  const proof = el('div', undefined, 'answer-source');
  proof.id = id;
  proof.tabIndex = -1;
  const title = text(source.document) || 'Document source';
  const passage = text(source.passage);
  const link = documentLink(title, source.url, true);
  proof.append(link ?? el('strong', title));
  if (passage) proof.append(el('p', passage));
  const published = dayText(source.publication);
  const checked = dayText(source.consultation);
  const dates = [
    published && 'Publié le ' + published,
    checked && 'Consulté le ' + checked,
  ].filter(Boolean);
  if (dates.length) proof.append(el('p', dates.join(' · '), 'answer-meta'));
  if (link && navigator.clipboard) {
    const copy = el('button', 'Copier la référence', 'answer-proof-action');
    copy.type = 'button';
    copy.setAttribute('aria-label', 'Copier la référence de ' + title);
    const status = el('span', undefined, 'answer-meta answer-copy-status');
    status.setAttribute('role', 'status');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(
          [title, passage, link.href].filter(Boolean).join('\n'),
        );
        status.textContent = 'Référence copiée.';
      } catch {
        status.textContent =
          'Sélectionnez le repère et l’adresse du document pour les copier.';
      }
    });
    proof.append(copy, status);
  }
  return proof;
}

function renderResult(entry: Record<string, unknown>, index: number) {
  const row = el('li', undefined, 'answer-result');
  const title = text(entry.titre);
  const h3 = el('h3');
  h3.append(documentLink(title, entry.url) ?? title);
  row.append(h3);
  const recorded = dayText(entry.date);
  const meta = [
    text(entry.auteur),
    labelFor(scopeNames, entry.statut) || text(entry.statut),
    recorded &&
      [labelFor(dateNames, entry.typeDate), recorded].filter(Boolean).join(' '),
  ].filter(Boolean);
  if (meta.length) row.append(el('p', meta.join(' · '), 'answer-meta'));
  const relation = record(entry.relation);
  const qualification = labelFor(relationNames, relation.qualification);
  if (qualification) {
    const note = el('p', undefined, 'answer-relation');
    note.append(el('strong', qualification));
    if (relation.statut === 'version-depassee') {
      const id = text(entry.id);
      const current = text(relation.versionCourante);
      const prefix = id + '-v';
      note.append(' · Version citée antérieure');
      if (
        /^[a-z\d]+(?:-[a-z\d]+)*$/.test(id) &&
        current.startsWith(prefix) &&
        /^[1-9]\d*$/.test(current.slice(prefix.length))
      ) {
        note.append(
          ' · ',
          anchor(
            'Lire la version actuelle',
            `/mesures/${id}/#version-${current.slice(prefix.length)}`,
          ),
        );
      }
    }
    row.append(note);
    if (text(relation.justification))
      row.append(el('p', text(relation.justification), 'answer-meta'));
  }
  if (text(entry.resume)) row.append(el('p', text(entry.resume)));
  const comparison = record(entry.comparaison);
  const comparisonState = labelFor(comparisonStates, comparison.etat);
  if (comparisonState) {
    row.append(el('p', comparisonState, 'answer-meta'));
  }
  const proofs = rows(entry.sources).map((source, position) => ({
    id: text(source.id),
    element: renderSource(source, `answer-source-${index}-${position}`),
  }));
  const figures = rows(entry.chiffres);
  if (figures.length) {
    const list = el('dl', undefined, 'answer-numbers');
    for (const figure of figures) {
      const value = [text(figure.valeur), text(figure.unite)]
        .filter(Boolean)
        .join(' ');
      const reading = el(
        'dd',
        [value, text(figure.periode), text(figure.base)]
          .filter(Boolean)
          .join(' · '),
      );
      const sourceID = text(figure.sourceId);
      const references = sourceID
        ? proofs.filter(({ id }) => id === sourceID)
        : [];
      if (references.length === 1) {
        const proof = references[0].element;
        const link = anchor('Source du chiffre', '#' + proof.id);
        link.addEventListener('click', () => {
          const details = proof.closest<HTMLDetailsElement>('details');
          if (details) details.open = true;
        });
        reading.append(' · ', link);
      }
      list.append(el('dt', text(figure.libelle)), reading);
    }
    row.append(list);
  }
  const [main, ...others] = proofs;
  if (main) row.append(main.element);
  if (others.length) {
    const remaining = el('details', undefined, 'answer-proof-list');
    remaining.append(
      el('summary', others.length === 1 ? 'Autre source' : 'Autres sources'),
    );
    remaining.append(...others.map(({ element }) => element));
    row.append(remaining);
  }
  const additional = rows(comparison.supplementaires).filter((item) =>
    text(item.titre),
  );
  if (additional.length) {
    const detail = el('details', undefined, 'answer-proof-list');
    const list = el('ul');
    detail.append(
      el('summary', 'Autres passages pour cette candidature'),
      list,
    );
    for (const [position, item] of additional.entries()) {
      const summary = el('li');
      const label = text(item.titre);
      summary.append(documentLink(label, item.url) ?? label);
      const context = [
        text(item.auteur),
        labelFor(scopeNames, item.statut),
        labelFor(relationNames, record(item.relation).qualification),
      ].filter(Boolean);
      if (context.length)
        summary.append(el('p', context.join(' · '), 'answer-meta'));
      if (text(item.resume)) summary.append(el('p', text(item.resume)));
      const proof = record(item.source);
      if (text(proof.document))
        summary.append(
          renderSource(proof, `answer-position-${index}-${position}`),
        );
      list.append(summary);
    }
    row.append(detail);
  }
  if (
    typeof comparison.resultatsTronques === 'number' &&
    comparison.resultatsTronques > 0
  ) {
    const more = documentLink(
      'Voir tous les passages de ce dossier',
      comparison.url,
    );
    if (more) row.append(more);
  }
  return row;
}

function present(title: string, detail: string, state: string) {
  heading.textContent = title;
  explanation.textContent = detail;
  panel.dataset.state = state;
  panel.hidden = false;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
}

function render(value: unknown) {
  const envelope = record(value);
  const answer = record(envelope.donnees);
  const state = text(answer.etat);
  const title = labelFor(statusTitles, state);
  if (!title || !Array.isArray(answer.resultats))
    throw Error('Structure inconnue');
  const items = rows(answer.resultats).filter((entry) => text(entry.titre));
  results.replaceChildren(...items.map(renderResult));
  correction.hidden = !items.length;
  for (const target of rows(answer.liens)) {
    const label = text(target.libelle);
    const link = label && documentLink(label, target.url);
    if (link) paths.append(link);
  }
  paths.hidden = !paths.childElementCount;

  const extent = record(answer.couverture);
  if (text(extent.perimetre)) scope.append(el('p', text(extent.perimetre)));
  if (
    typeof extent.total === 'number' &&
    Number.isSafeInteger(extent.total) &&
    extent.total > items.length
  ) {
    const matched =
      items.length === 1 ? 'résultat affiché' : 'résultats affichés';
    scope.append(
      el(
        'p',
        `${number(items.length)} ${matched} sur ${number(extent.total)}.`,
      ),
    );
  }
  if (text(envelope.corpusVerifieLe)) {
    scope.append(
      el('p', 'Corpus vérifié le ' + dayText(envelope.corpusVerifieLe) + '.'),
    );
  }
  const revision = text(envelope.revisionDuSite);
  if (/^[a-f\d]{40}$/.test(revision)) {
    const edition = el('p', 'Révision du corpus ');
    const code = el('code', revision.slice(0, 12));
    code.title = revision;
    edition.append(code);
    scope.append(edition);
  }
  const index = documentLink('Consulter le périmètre', extent.url);
  if (index) scope.append(index);
  coverage.hidden = !scope.childElementCount;
  present(
    ((state === 'documente' || (state === 'partiel' && items.length > 0)) &&
      text(answer.titre)) ||
      title,
    text(answer.explication),
    state,
  );
}

function updateLocalLink(question: string) {
  search.hash = question
    ? new URLSearchParams({ q: question.slice(0, 200) }).toString()
    : '';
}
const prefill = new URLSearchParams(location.hash.slice(1)).get('q');
if (prefill !== null) {
  input.value = prefill.trim().slice(0, input.maxLength);
  history.replaceState(history.state, '', location.pathname + location.search);
  updateLocalLink(input.value);
}
function applyQuestion() {
  updateLocalLink(input.value.trim());
  panel.hidden = true;
}
input.addEventListener('input', applyQuestion);
for (const button of form.querySelectorAll<HTMLButtonElement>(
  '[data-example]',
)) {
  button.addEventListener('click', () => {
    input.value = button.dataset.example ?? '';
    applyQuestion();
    input.focus();
  });
}
let pending = false;
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (pending) return;
  const question = input.value.trim();
  if (!question) {
    notice.textContent = 'Saisissez une question.';
    input.focus();
    return;
  }
  pending = true;
  form.setAttribute('aria-busy', 'true');
  submit.setAttribute('aria-disabled', 'true');
  panel.hidden = true;
  results.replaceChildren();
  paths.replaceChildren();
  paths.hidden = true;
  correction.hidden = true;
  scope.replaceChildren();
  coverage.hidden = true;
  coverage.open = false;
  notice.textContent = 'Recherche documentaire en cours.';
  try {
    const response = await fetch('/api/v1/reponse', {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ question }),
    });
    if (response.status === 429 && input.value.trim() === question) {
      present(
        'Trop de demandes',
        'Réessayez dans un instant ou poursuivez dans la recherche locale.',
        'indisponible',
      );
      return;
    }
    if (!response.ok) throw Error('Réponse indisponible');
    const payload: unknown = await response.json();
    if (input.value.trim() === question) render(payload);
  } catch {
    if (input.value.trim() === question) {
      present(
        'Réponse documentaire indisponible',
        'Réessayez ou poursuivez dans la recherche locale avec votre question.',
        'indisponible',
      );
    }
  } finally {
    notice.textContent = '';
    form.removeAttribute('aria-busy');
    submit.removeAttribute('aria-disabled');
    pending = false;
  }
});
form.hidden = false;
