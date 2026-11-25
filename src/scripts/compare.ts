import {
  corpus,
  el,
  anchor,
  measureCard,
  renderMetricPlots,
  date,
  download,
} from './ui';
import { metricGroups } from '../lib/features.mjs';
import type { Corpus } from '../lib/data';
const form = document.querySelector<HTMLFormElement>('#compare-form')!,
  themeSelect = document.querySelector<HTMLSelectElement>('#compare-theme')!,
  question = document.querySelector<HTMLSelectElement>('#compare-question')!,
  questionDetail = document.querySelector<HTMLAnchorElement>(
    '#compare-question-detail',
  )!,
  archives = document.querySelector<HTMLInputElement>('#compare-archives')!,
  feedback = document.querySelector<HTMLElement>('#comparison-feedback')!,
  third = document.querySelector<HTMLInputElement>('#compare-third')!,
  comparison = document.querySelector<HTMLElement>('#comparaison')!,
  heading = document.querySelector<HTMLElement>('#comparison-theme-title')!,
  jumps = document.querySelector<HTMLElement>('.comparison-jumps')!,
  exportButton =
    document.querySelector<HTMLButtonElement>('#comparison-export')!,
  selects = [0, 1, 2].map((index) =>
    document.querySelector<HTMLSelectElement>(`#compare-candidate-${index}`)!,
  );
function start() {
  const valid = new Set(
    Array.from(selects[0].options, (option) => option.value).filter(Boolean),
  );
  function restore() {
    const params = new URLSearchParams(location.search);
    const ids = [
      ...new Set(
        (params.get('c') || '').split(',').filter((id) => valid.has(id)),
      ),
    ].slice(0, 3);
    themeSelect.value = params.get('theme') ?? '';
    if (!themeSelect.value) themeSelect.selectedIndex = 0;
    question.value = params.get('question') ?? '';
    if (question.selectedIndex === -1) question.selectedIndex = 0;
    archives.checked = params.get('archives') === '1';
    third.checked = ids.length === 3 || params.get('count') === '3';
    selects.forEach((select, index) => {
      select.value = ids[index] ?? '';
    });
    void render();
  }
  let generation = 0;
  let exportData: string | undefined;
  async function render(focus = false, save = false) {
    const count = third.checked ? 3 : 2;
    const ticket = ++generation;
    const active = [
      ...new Set(
        selects
          .slice(0, count)
          .map((select) => select.value)
          .filter(Boolean),
      ),
    ];
    selects[2].parentElement!.hidden = count === 2;
    selects.forEach((select, index) =>
      Array.from(select.options).forEach((option) => {
        option.disabled =
          !!option.value &&
          index < count &&
          active.includes(option.value) &&
          select.value !== option.value;
      }),
    );
    const theme = themeSelect.selectedOptions[0];
    const subject = question.value ? question.selectedOptions[0] : null;
    const questionPath = subject
      ? '/questions/' + subject.value + '/'
      : '/questions/';
    questionDetail.href = questionPath;
    questionDetail.textContent = subject
      ? 'Voir toutes les positions sur cette question'
      : 'Parcourir les questions';
    themeSelect.disabled = Boolean(subject);
    archives.disabled = Boolean(subject);
    const themeId = subject?.dataset.theme ?? theme.value;
    const includeArchives = !subject && archives.checked;
    heading.textContent = subject?.text ?? theme.text;
    document.querySelector('#comparison-note')!.textContent = subject
      ? 'Les propositions et textes reliés à cette question.'
      : theme.dataset.note || '';
    const container = document.querySelector<HTMLElement>('#comparison-cards')!;
    container.dataset.count = String(count);
    container.replaceChildren();
    jumps.replaceChildren();
    jumps.hidden = true;
    comparison.hidden = active.length < 2;
    exportData = undefined;
    exportButton.disabled = true;
    const query = new URLSearchParams();
    if (theme.value !== themeSelect.options[0].value)
      query.set('theme', theme.value);
    if (active.length) query.set('c', active.join(','));
    if (count === 3 && active.length < 3) query.set('count', '3');
    if (archives.checked) query.set('archives', '1');
    if (subject) query.set('question', subject.value);
    const address =
      location.pathname + (query.size ? '?' + query : '') + location.hash;
    if (save && address !== location.pathname + location.search + location.hash)
      history.pushState(null, '', address);
    if (active.length < 2) {
      document.querySelector('#comparison-metrics')!.replaceChildren();
      feedback.textContent = active.length
        ? 'Choisissez une deuxième candidature.'
        : 'Choisissez deux candidatures à comparer.';
      if (focus) selects.find((select) => !select.value)?.focus();
      return;
    }
    feedback.textContent = 'Chargement des propositions…';
    document.querySelector('#comparison-metrics')!.replaceChildren();
    let data;
    try {
      data = await corpus();
    } catch {
      if (ticket === generation)
        feedback.textContent =
          'Le corpus interactif n’a pas pu être chargé. Les propositions restent accessibles depuis les pages thématiques.';
      return;
    }
    if (ticket !== generation) return;
    const versionIds = new Set(subject?.dataset.versions?.split(' ') ?? []);
    const vByMeasure = new Map<string, Corpus['versions'][number]>();
    const relevant = subject
      ? data.versions
          .filter((version) => versionIds.has(version.id))
          .flatMap((version) => {
            const measure = data.measures.find(
              (entry) => entry.id === version.measureId,
            );
            if (!measure || !active.includes(measure.candidate)) return [];
            vByMeasure.set(measure.id, version);
            const { id, parentId, candidate, theme, revision } = measure;
            return [
              { ...version.snapshot, id, parentId, candidate, theme, revision },
            ];
          })
      : data.measures.filter(
          (measure) =>
            active.includes(measure.candidate) &&
            measure.theme === themeId &&
            (measure.scope !== 'archive' || includeArchives),
        );
    let available = 0;
    for (const id of active) {
      const candidate = data.candidates.find(
          (candidate) => candidate.id === id,
        )!,
        items = relevant.filter((measure) => measure.candidate === id);
      const card = el('article', undefined, 'comparison-card'),
        header = el('header');
      header.append(el('p', candidate.party), el('h3', candidate.name));
      const body = el('div', undefined, 'comparison-body');
      if (items.length) {
        available++;
        for (const measure of items)
          body.append(
            measureCard(measure, data, true, 'h4', vByMeasure.get(measure.id)),
          );
      } else {
        const reviewed = subject?.dataset.reviewed?.split(' ').includes(id);
        const old = data.measures.some(
          (measure) =>
            measure.candidate === id &&
            measure.theme === themeId &&
            measure.scope === 'archive',
        );
        body.append(
          el(
            'h4',
            subject
              ? 'Position non documentée'
              : old
                ? 'Archive de 2022 disponible'
                : 'Aucune fiche dans le corpus',
          ),
          el(
            'p',
            subject
              ? reviewed
                ? 'Un document a été examiné. Aucune proposition n’a été reliée à cette question.'
                : 'Aucune proposition reliée à cette question pour ce candidat.'
              : old
                ? 'Activez les archives pour consulter ce document avec son millésime.'
                : 'Le thème reste à renseigner pour ce candidat.',
          ),
        );
      }
      const footer = el('footer');
      footer.append(anchor('Dossier du candidat ↗', `/candidats/${id}/`));
      card.append(header, body, footer);
      card.id = 'comparaison-' + id;
      jumps.append(anchor(candidate.name, '#' + card.id));
      container.append(card);
    }
    const metrics = document.querySelector<HTMLElement>('#comparison-metrics')!;
    renderMetricPlots(metrics, metricGroups(relevant, data.candidates));
    if (subject)
      metrics.append(
        anchor('Voir le contexte et les divergences documentées', questionPath),
      );
    jumps.hidden = false;
    const sourceIds = new Set(
      relevant.flatMap((item) => item.sourceRefs.map((ref) => ref.sourceId)),
    );
    exportData = JSON.stringify(
      {
        corpusUpdated: data.meta.corpusUpdated,
        theme: themeId,
        candidates: active,
        includeArchives,
        measures: relevant,
        sources: data.sources.filter((source) => sourceIds.has(source.id)),
        ...(subject
          ? { question: subject.value, versions: [...vByMeasure.values()] }
          : {}),
      },
      null,
      2,
    );
    exportButton.disabled = false;
    if (focus) heading.focus();
    feedback.textContent = `${available} candidature${available > 1 ? 's' : ''} renseignée${available > 1 ? 's' : ''} sur ${active.length} · ${relevant.length} fiche${relevant.length > 1 ? 's' : ''} · corpus du ${date(data.meta.corpusUpdated)}`;
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void render(true, true);
  });
  form.addEventListener('change', () => void render(false, true));
  window.addEventListener('popstate', restore);
  exportButton.addEventListener('click', () => {
    if (exportData)
      download(
        exportData,
        'application/json;charset=utf-8',
        'polradar-comparaison.json',
      );
  });
  document
    .querySelector('#comparison-share')!
    .addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        feedback.textContent = 'Lien de comparaison copié.';
      } catch {
        feedback.textContent =
          'Copiez l’adresse pour partager cette comparaison.';
      }
    });
  document
    .querySelector('#comparison-print')!
    .addEventListener('click', () => window.print());
  form.hidden = false;
  restore();
}
start();
