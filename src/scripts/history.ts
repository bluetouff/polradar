import { corpus, el, anchor, date, icon } from './ui';
import { snapshotChanges, lineDiff } from '../lib/features.mjs';
import {
  historyRecordingDay,
  recordedVersionAt,
  validHistoryDate,
} from '../lib/history-dates.mjs';
import type { Measure, MeasureVersion } from '../lib/data';
const form = document.querySelector<HTMLFormElement>('#history-form')!,
  choice = document.querySelector<HTMLSelectElement>('#history-measure')!,
  mode = document.querySelector<HTMLSelectElement>('#history-mode')!,
  dateHelp = document.querySelector<HTMLElement>('#history-date-help')!,
  first = document.querySelector<HTMLInputElement>('#history-date-before')!,
  last = document.querySelector<HTMLInputElement>('#history-date-after')!,
  before = document.querySelector<HTMLSelectElement>('#history-before')!,
  after = document.querySelector<HTMLSelectElement>('#history-after')!,
  result = document.querySelector<HTMLElement>('#history-result')!,
  status = document.querySelector<HTMLElement>('#history-status')!;
const labels: Record<string, string> = {
  title: 'Titre',
  description: 'Proposition',
  beneficiaries: 'Bénéficiaires',
  timing: 'Calendrier',
  financing: 'Financement',
  metrics: 'Paramètres chiffrés',
  amounts: 'Montants',
  sourceRefs: 'Références',
  scope: 'Nature du document',
  partyAuthor: 'Auteur collectif',
  edition: 'Édition',
  checked: 'Date de consultation',
};
function value(key: string, input: any) {
  if (input === null || input === undefined || input.length === 0)
    return 'Non renseigné';
  if (key === 'metrics')
    return input
      .map(
        (row: any) =>
          `${row.label} : ${row.value.toLocaleString('fr-FR')} ${row.unit}`,
      )
      .join('\n');
  if (key === 'amounts')
    return input
      .map(
        (row: any) =>
          `${row.label} : ${row.value.toLocaleString('fr-FR')} ${row.unit} / ${row.period} ${row.basis === 'non-applicable' ? '' : row.basis}`,
      )
      .join('\n');
  if (key === 'sourceRefs')
    return input.map((row: any) => row.locator).join('\n');
  if (key === 'checked') return date(input);
  return String(input);
}
const kind: Record<MeasureVersion['kind'], string> = {
  import: 'Reprise du corpus',
  enrichissement: 'Précisions éditoriales',
  correction: 'Correction éditoriale',
  programme: 'Évolution du programme',
};
const timestamp = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});
const revision = document.querySelector<HTMLElement>('#comparaison-historique')!
  .dataset.sourceCommit;
const validRevision = /^[a-f0-9]{40}$/;
type State = { version: MeasureVersion | null; day?: string };

function versionColumn(state: State, path: string, showValue: boolean) {
  const side = el('div');
  if (state.day) {
    const day = el('time', date(state.day));
    day.dateTime = state.day;
    const label = el('strong');
    label.append(day);
    side.append(label);
  }
  const version = state.version;
  if (!version) {
    side.append(
      el('p', 'Aucune version datée à cette date dans cette édition.'),
    );
    return side;
  }
  const recording = version.recordedAt;
  side.append(
    el('span', `V${version.number}`, 'version-pill'),
    el('span', kind[version.kind]),
    el('p', `Observation du ${date(version.observedOn)}`),
    el(
      'p',
      recording
        ? `Enregistrement le ${timestamp.format(new Date(recording))}`
        : 'Date d’enregistrement inconnue',
    ),
    el('p', version.summary),
    anchor(
      `Voir la version ${version.number} ↗`,
      `${path}#version-${version.number}`,
    ),
  );
  if (showValue) side.append(el('p', version.snapshot.description));
  return side;
}

function renderComparison(measure: Measure, states: [State, State]) {
  const path = `/mesures/${measure.id}/`;
  const heading = el('div', undefined, 'history-heading');
  heading.append(
    icon('historique'),
    el('h3', measure.title),
    anchor('Voir la fiche ↗', path),
  );
  const [a, b] = states.map((state) => state.version);
  const strip = el('div', undefined, 'version-strip');
  for (const state of states)
    strip.append(versionColumn(state, path, !a || !b || a === b));
  result.replaceChildren(heading, strip);
  if (!a || !b) return;

  const changes = snapshotChanges(a.snapshot, b.snapshot);
  const diff = el('div', undefined, 'snapshot-diff');
  if (!changes.length)
    diff.append(
      el(
        'p',
        a.number === b.number
          ? 'Une seule version est sélectionnée.'
          : 'Aucune différence de contenu dans cette sélection.',
        'notice',
      ),
    );
  for (const change of changes) {
    const row = el('section', undefined, 'diff-field');
    row.append(el('h4', labels[change.key] || change.key));
    const columns = el('div', undefined, 'diff-columns');
    const left = el('div', undefined, 'diff-before'),
      right = el('div', undefined, 'diff-after');
    const lines = lineDiff(
      value(change.key, change.before),
      value(change.key, change.after),
    );
    for (const line of lines) {
      if (line.kind !== 'added')
        left.append(
          el(
            'p',
            line.text,
            line.kind === 'removed' ? 'diff-removed' : 'diff-equal',
          ),
        );
      if (line.kind !== 'removed')
        right.append(
          el(
            'p',
            line.text,
            line.kind === 'added' ? 'diff-added' : 'diff-equal',
          ),
        );
    }
    columns.append(left, right);
    row.append(columns);
    diff.append(row);
  }
  result.append(diff);
  status.textContent = `${changes.length} champ${changes.length > 1 ? 's' : ''} différent${changes.length > 1 ? 's' : ''} · versions ${a.number} et ${b.number}`;
}

function archiveLink(sha: string) {
  return anchor(
    `Archive de l’édition ${sha.slice(0, 12)} ↗`,
    `https://github.com/bluetouff/polradar/releases/download/site-${sha}/corpus-v1.tar.gz`,
  );
}

async function start() {
  status.textContent = 'Chargement des versions…';
  const data = await corpus();
  const params = new URLSearchParams(location.search);
  if (data.measures.some((measure) => measure.id === params.get('mesure')))
    choice.value = params.get('mesure')!;
  mode.value = params.get('mode') === 'dates' ? 'dates' : 'versions';
  let rows: MeasureVersion[] = [];
  let requestedRevision = params.get('revision');

  function options(requestedBefore?: number, requestedAfter?: number) {
    rows = data.versions
      .filter((version) => version.measureId === choice.value)
      .sort((a, b) => a.number - b.number);
    for (const select of [before, after])
      select.replaceChildren(
        ...rows.map((version) => {
          const option = el(
            'option',
            `Version ${version.number} · ${date(version.observedOn)}`,
          );
          option.value = String(version.number);
          return option;
        }),
      );
    before.value = String(
      rows.some((row) => row.number === requestedBefore)
        ? requestedBefore
        : ((rows.at(-2) ?? rows.at(-1))?.number ?? ''),
    );
    after.value = String(
      rows.some((row) => row.number === requestedAfter)
        ? requestedAfter
        : (rows.at(-1)?.number ?? ''),
    );
    const days = rows
      .map((version) => historyRecordingDay(version.recordedAt))
      .filter(Boolean)
      .sort();
    first.value = days.at(0) ?? '';
    last.value = days.at(-1) ?? '';
  }

  function render() {
    const dated = mode.value === 'dates';
    dateHelp.hidden = !dated;
    for (const field of [first, last, before, after]) {
      const show = dated === field instanceof HTMLInputElement;
      field.closest('label')!.hidden = !show;
      field.disabled = !show || !choice.value;
      field.required = show;
      field.removeAttribute('aria-invalid');
    }
    result.replaceChildren();
    if (dated && requestedRevision !== null && requestedRevision !== revision) {
      status.textContent =
        'L’édition demandée diffère de celle servie actuellement.';
      if (validRevision.test(requestedRevision))
        result.append(archiveLink(requestedRevision));
      if (choice.value)
        result.append(
          el('p', 'Le bouton Comparer utilise l’édition actuelle.'),
        );
      return;
    }
    if (!choice.value) {
      status.textContent = 'Choisissez une fiche pour comparer ses versions.';
      return;
    }
    const measure = data.measures.find((item) => item.id === choice.value)!;
    const url = new URL(location.href);
    for (const key of [
      'mode',
      'avant',
      'apres',
      'dateAvant',
      'dateApres',
      'revision',
    ])
      url.searchParams.delete(key);
    url.searchParams.set('mesure', measure.id);
    if (dated) {
      if (!validHistoryDate(first.value) || !validHistoryDate(last.value)) {
        status.textContent = 'Renseignez les deux dates.';
        return;
      }
      if (first.value > last.value) {
        status.textContent = 'La première date doit précéder la deuxième.';
        first.setAttribute('aria-invalid', 'true');
        last.setAttribute('aria-invalid', 'true');
        return;
      }
      const a = recordedVersionAt(rows, first.value);
      const b = recordedVersionAt(rows, last.value);
      renderComparison(measure, [
        { version: a, day: first.value },
        { version: b, day: last.value },
      ]);
      if (!a || !b)
        status.textContent =
          'La comparaison reste incomplète faute de version datée.';
      const undated = rows.filter((version) => !version.recordedAt).length;
      const edition = el(
        'p',
        `Édition du ${date(data.meta.edition)}`,
        'results-meta',
      );
      if (revision)
        edition.append(document.createTextNode(' · '), archiveLink(revision));
      result.prepend(edition);
      if (undated)
        result.append(
          el(
            'p',
            `Date d’enregistrement inconnue pour ${undated} version${undated > 1 ? 's' : ''}. Ces versions restent consultables par numéro.`,
            'notice',
          ),
        );
      url.searchParams.set('mode', 'dates');
      url.searchParams.set('dateAvant', first.value);
      url.searchParams.set('dateApres', last.value);
      if (revision) url.searchParams.set('revision', revision);
    } else {
      const low = Math.min(Number(before.value), Number(after.value));
      const high = Math.max(Number(before.value), Number(after.value));
      const a = rows.find((version) => version.number === low);
      const b = rows.find((version) => version.number === high);
      if (!a || !b) {
        status.textContent = 'Versions de cette fiche indisponibles.';
        return;
      }
      before.value = String(low);
      after.value = String(high);
      renderComparison(measure, [{ version: a }, { version: b }]);
      url.searchParams.set('avant', String(low));
      url.searchParams.set('apres', String(high));
    }
    history.replaceState(null, '', url);
  }

  choice.addEventListener('change', () => {
    requestedRevision = null;
    options();
    render();
  });
  mode.addEventListener('change', () => {
    requestedRevision = null;
    render();
  });
  for (const field of [before, after]) field.addEventListener('change', render);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    requestedRevision = null;
    render();
  });
  options(Number(params.get('avant')), Number(params.get('apres')));
  if (params.has('dateAvant')) first.value = params.get('dateAvant')!;
  if (params.has('dateApres')) last.value = params.get('dateApres')!;
  render();
  form.hidden = false;
}
start().catch(() => {
  status.textContent =
    'La comparaison des versions n’a pas pu être chargée. Le journal ci-dessous reste consultable.';
});
