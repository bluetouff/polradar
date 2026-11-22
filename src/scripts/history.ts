import { corpus, el, anchor, date, icon } from './ui';
import { snapshotChanges, lineDiff } from '../lib/features.mjs';
const form = document.querySelector<HTMLFormElement>('#history-form')!,
  choice = document.querySelector<HTMLSelectElement>('#history-measure')!,
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
async function start() {
  const data = await corpus(),
    params = new URLSearchParams(location.search);
  if (data.measures.some((measure) => measure.id === params.get('mesure')))
    choice.value = params.get('mesure')!;
  function options(requestedBefore?: number, requestedAfter?: number) {
    before.disabled = after.disabled = !choice.value;
    if (!choice.value) {
      before.replaceChildren();
      after.replaceChildren();
      return;
    }
    const rows = data.versions
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
        : Math.max(1, rows.length - 1),
    );
    after.value = String(
      rows.some((row) => row.number === requestedAfter)
        ? requestedAfter
        : rows.length,
    );
  }
  function render() {
    if (!choice.value) {
      result.replaceChildren();
      status.textContent = 'Choisissez une fiche pour comparer ses versions.';
      const url = new URL(location.href);
      for (const key of ['mesure', 'avant', 'apres'])
        url.searchParams.delete(key);
      history.replaceState(null, '', url);
      return;
    }
    const measure = data.measures.find(
      (measure) => measure.id === choice.value,
    )!;
    const low = Math.min(Number(before.value), Number(after.value)),
      high = Math.max(Number(before.value), Number(after.value));
    before.value = String(low);
    after.value = String(high);
    const a = data.versions.find(
        (version) => version.measureId === measure.id && version.number === low,
      )!,
      b = data.versions.find(
        (version) =>
          version.measureId === measure.id && version.number === high,
      )!;
    const changes = snapshotChanges(a.snapshot, b.snapshot);
    result.replaceChildren();
    const heading = el('div', undefined, 'history-heading');
    heading.append(
      icon('historique'),
      el('h3', measure.title),
      anchor('Voir la fiche ↗', `/mesures/${measure.id}/`),
    );
    result.append(heading);
    const kind: Record<string, string> = {
      import: 'Reprise du corpus',
      enrichissement: 'Précisions éditoriales',
      correction: 'Correction',
      programme: 'Évolution du programme',
    };
    const strip = el('div', undefined, 'version-strip');
    for (const version of [a, b]) {
      const column = el('div');
      column.append(
        el('span', `V${version.number}`, 'version-pill'),
        el('strong', date(version.observedOn)),
        el('span', kind[version.kind]),
        el('p', version.summary),
      );
      strip.append(column);
    }
    result.append(strip);
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
    const url = new URL(location.href);
    url.searchParams.set('mesure', measure.id);
    url.searchParams.set('avant', String(a.number));
    url.searchParams.set('apres', String(b.number));
    history.replaceState(null, '', url);
  }
  choice.addEventListener('change', () => {
    options();
    render();
  });
  form.addEventListener('change', render);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    render();
  });
  options(Number(params.get('avant')), Number(params.get('apres')));
  render();
}
start().catch(() => {
  status.textContent =
    'La comparaison des versions n’a pas pu être chargée. Le journal ci-dessous reste consultable.';
});
