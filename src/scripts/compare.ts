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
import { attributionLabel } from '../lib/attribution.mjs';
import type { Corpus } from '../lib/data';

interface QuestionReading {
  candidates: number;
  coverage: Record<string, string>;
  reviews: {
    candidate: string;
    sourceId: string;
    locator: string;
    checked: string;
  }[];
  context?: string;
  positions?: { label: string; versions: string[] }[];
  related?: { label: string; href: string };
}
const coverageLabels: Record<string, string> = {
  mesure: 'Proposition de campagne',
  declaration: 'Déclaration publique',
  orientation: 'Orientation documentée',
  parti: 'Texte de parti',
  revue: 'Document examiné',
};
const selectionFragment = '#comparaison?';

const form = document.querySelector<HTMLFormElement>('#compare-form')!,
  themeSelect = document.querySelector<HTMLSelectElement>('#compare-theme')!,
  question = document.querySelector<HTMLSelectElement>('#compare-question')!,
  questionDetail = document.querySelector<HTMLAnchorElement>(
    '#compare-question-detail',
  )!,
  questionCoverage = document.querySelector<HTMLElement>(
    '#compare-question-coverage',
  )!,
  archives = document.querySelector<HTMLInputElement>('#compare-archives')!,
  feedback = document.querySelector<HTMLElement>('#comparison-feedback')!,
  third = document.querySelector<HTMLInputElement>('#compare-third')!,
  comparison = document.querySelector<HTMLElement>('#comparaison')!,
  heading = document.querySelector<HTMLElement>('#comparison-theme-title')!,
  positions = document.querySelector<HTMLElement>('#comparison-positions')!,
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
    const carried = location.hash.startsWith(selectionFragment);
    if (carried) {
      const retained = new URLSearchParams(
        location.hash.slice(selectionFragment.length),
      );
      for (const key of ['c', 'theme', 'archives', 'count']) {
        const value = retained.get(key);
        if (value) params.set(key, value);
      }
    }
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
    void render(false, carried ? 'replace' : undefined);
  }
  let generation = 0;
  let exportData: string | undefined;
  async function render(focus = false, save?: 'push' | 'replace') {
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
    const reading = subject
      ? (JSON.parse(subject.dataset.reading!) as QuestionReading)
      : null;
    const questionPath = subject
      ? '/questions/' + subject.value + '/'
      : '/questions/';
    themeSelect.disabled = Boolean(subject);
    themeSelect.parentElement!.hidden = Boolean(subject);
    archives.disabled = Boolean(subject);
    archives.parentElement!.hidden = Boolean(subject);
    const themeId = subject?.dataset.theme ?? theme.value;
    const includeArchives = !subject && archives.checked;
    heading.textContent = subject?.text ?? theme.text;
    document.querySelector('#comparison-note')!.textContent = subject
      ? (reading?.context ?? '')
      : theme.dataset.note || '';
    const container = document.querySelector<HTMLElement>('#comparison-cards')!;
    container.dataset.count = String(active.length);
    container.replaceChildren();
    positions.replaceChildren();
    positions.hidden = true;
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
    const detailQuery = query.toString();
    questionDetail.href =
      questionPath +
      (subject && detailQuery ? selectionFragment + detailQuery : '');
    questionDetail.textContent = subject
      ? 'Voir toutes les réponses'
      : 'Parcourir les questions';
    questionCoverage.hidden = !reading;
    questionCoverage.textContent = reading
      ? reading.candidates === 0
        ? 'Aucune position reliée à cette question.'
        : `${reading.candidates} dossier${reading.candidates > 1 ? 's' : ''} avec une réponse sourcée`
      : '';
    if (subject) query.set('question', subject.value);
    const address =
      location.pathname +
      (query.size ? '?' + query : '') +
      (save === 'replace' ? '' : location.hash);
    if (save === 'replace') history.replaceState(null, '', address);
    if (
      save === 'push' &&
      address !== location.pathname + location.search + location.hash
    )
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
    const selected = data.candidates.filter(({ id }) => active.includes(id));
    const measuresById = new Map(data.measures.map((m) => [m.id, m]));
    const relevant = subject
      ? data.versions
          .filter((version) => versionIds.has(version.id))
          .flatMap((version) => {
            const measure = measuresById.get(version.measureId);
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
    const approaches = el('ul');
    for (const approach of reading?.positions ?? []) {
      const authors = new Set<string>();
      for (const measure of relevant) {
        const version = vByMeasure.get(measure.id);
        if (!version || !approach.versions.includes(version.id)) continue;
        const candidateName = selected.find(
          ({ id }) => id === measure.candidate,
        )!.name;
        authors.add(attributionLabel(version.snapshot, candidateName));
      }
      if (authors.size) {
        const item = el('li');
        item.append(
          el('strong', approach.label),
          el('span', [...authors].join(' · ')),
        );
        approaches.append(item);
      }
    }
    if (approaches.childElementCount) {
      positions.append(el('h3', 'Approches documentées'), approaches);
      positions.hidden = false;
    }
    if (reading?.related) {
      positions.append(anchor(reading.related.label, reading.related.href));
      positions.hidden = false;
    }
    let available = 0;
    for (const id of active) {
      const candidate = selected.find((candidate) => candidate.id === id)!,
        items = relevant.filter((measure) => measure.candidate === id);
      const card = el('article', undefined, 'comparison-card'),
        header = el('header');
      header.append(el('p', candidate.party), el('h3', candidate.name));
      const state = reading?.coverage[id];
      if (state && Object.hasOwn(coverageLabels, state))
        header.append(el('p', coverageLabels[state], 'compare-coverage'));
      if (items.length)
        header.append(
          el(
            'p',
            `${items.length} fiche${items.length === 1 ? '' : 's'}`,
            'comparison-count',
          ),
        );
      const body = el('div', undefined, 'comparison-body');
      if (items.length) {
        available++;
        for (const measure of items)
          body.append(
            measureCard(measure, data, true, 'h4', vByMeasure.get(measure.id)),
          );
      } else {
        const review = reading?.reviews.find(
          ({ candidate }) => candidate === id,
        );
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
              ? review
                ? review.locator
                : 'Aucune proposition reliée à cette question pour ce candidat.'
              : old
                ? 'Activez les archives pour consulter ce document avec son millésime.'
                : 'Le thème reste à renseigner pour ce candidat.',
          ),
        );
        if (review) {
          const original = data.sources.find(
            ({ id }) => id === review.sourceId,
          );
          if (original) {
            const link = anchor(original.title, original.url);
            link.rel = 'noreferrer';
            const details = el('p');
            details.append(
              document.createTextNode(
                'Examiné le ' + date(review.checked) + ' · ',
              ),
              link,
            );
            body.append(details);
          }
        }
      }
      const footer = el('footer');
      footer.append(anchor('Dossier du candidat ↗', `/candidats/${id}/`));
      card.append(header, body, footer);
      card.id = 'comparaison-' + id;
      jumps.append(anchor(candidate.name, '#' + card.id));
      container.append(card);
    }
    const metrics = document.querySelector<HTMLElement>('#comparison-metrics')!;
    // A shared key can cover distinct rules, such as an age target and eligibility.
    const comparable = relevant.map((measure) => ({
      ...measure,
      metrics: measure.metrics.map((metric) => ({
        ...metric,
        key: JSON.stringify([metric.key, metric.label]),
      })),
    }));
    renderMetricPlots(metrics, metricGroups(comparable, data.candidates));
    if (subject)
      metrics.append(anchor('Voir toutes les réponses', questionDetail.href));
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
    void render(true, 'push');
  });
  form.addEventListener('change', () => void render(false, 'push'));
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
