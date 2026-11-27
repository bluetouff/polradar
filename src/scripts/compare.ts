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
import { saveView } from './saved-views';
import { initializeCandidateSearch } from './compare-candidate-search';
import { attributionLabel } from '../lib/attribution.mjs';
import {
  comparisonIds,
  comparisonSlots,
  maxComparisonCandidates,
} from '../lib/compare-selection';
import type { Corpus } from '../lib/data';

interface QuestionReading {
  candidates: number;
  coverage: Record<string, string>;
  alerts: Record<string, string>;
  complements: { versionId: string; justification: string }[];
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
  selectionNote = document.querySelector<HTMLElement>(
    '#comparison-selection-note',
  )!,
  third = document.querySelector<HTMLInputElement>('#compare-third')!,
  add = document.querySelector<HTMLButtonElement>('#compare-add')!,
  comparison = document.querySelector<HTMLElement>('#comparaison')!,
  heading = document.querySelector<HTMLElement>('#comparison-theme-title')!,
  positions = document.querySelector<HTMLElement>('#comparison-positions')!,
  jumps = document.querySelector<HTMLElement>('.comparison-jumps')!,
  exportButton =
    document.querySelector<HTMLButtonElement>('#comparison-export')!,
  saveButton = document.querySelector<HTMLButtonElement>('#comparison-save')!,
  selects = Array.from(
    form.querySelectorAll<HTMLSelectElement>('.compare-person select'),
  );
function start() {
  initializeCandidateSearch(selects);
  const valid = new Set(
    Array.from(selects[0].options, (option) => option.value).filter(Boolean),
  );
  const slots = selects.map((select) => ({
    wrapper: select.parentElement!,
    earlier: select.parentElement!.querySelector<HTMLButtonElement>(
      '[data-order=earlier]',
    )!,
    later:
      select.parentElement!.querySelector<HTMLButtonElement>(
        '[data-order=later]',
      )!,
    remove: select.parentElement!.querySelector<HTMLButtonElement>(
      '[data-order=remove]',
    )!,
  }));
  let count = 2;
  let useFragment = true;
  function restore() {
    const params = new URLSearchParams(location.search);
    const carried = location.hash.startsWith(selectionFragment);
    useFragment = carried || !params.has('c');
    if (carried) {
      const retained = new URLSearchParams(
        location.hash.slice(selectionFragment.length),
      );
      for (const key of ['c', 'theme', 'question', 'archives', 'count']) {
        const value = retained.get(key);
        if (value) params.set(key, value);
      }
    }
    const raw = params.get('c');
    const ids = comparisonIds(raw, valid);
    const rejected = raw !== null && raw !== '' && raw !== ids.join(',');
    selectionNote.hidden = !rejected;
    selectionNote.textContent = rejected
      ? 'Le lien a été corrigé. Seuls les six premiers identifiants valides et distincts sont retenus.'
      : '';
    themeSelect.value = params.get('theme') ?? '';
    if (!themeSelect.value) themeSelect.selectedIndex = 0;
    question.value = params.get('question') ?? '';
    if (question.selectedIndex === -1) question.selectedIndex = 0;
    archives.checked = params.get('archives') === '1';
    count = comparisonSlots(params.get('count'), ids.length);
    selects.forEach((select, index) => {
      select.value = ids[index] ?? '';
    });
    void render(false, carried ? 'replace' : undefined);
  }
  let generation = 0;
  let exportData: string | undefined;
  let savedView: { parameters: URLSearchParams; title: string } | undefined;
  async function render(focus = false, save?: 'push' | 'replace') {
    const ticket = ++generation;
    const active = [
      ...new Set(
        selects
          .slice(0, count)
          .map((select) => select.value)
          .filter(Boolean),
      ),
    ];
    third.checked = count >= 3;
    third.parentElement!.hidden = count > 3;
    add.hidden = count < 3 || count === maxComparisonCandidates;
    slots.forEach(({ wrapper, earlier, later, remove }, index) => {
      const chosen = Boolean(selects[index].value);
      wrapper.hidden = index >= count;
      earlier.disabled = !chosen || index === 0 || !selects[index - 1]?.value;
      later.disabled =
        !chosen || index + 1 >= count || !selects[index + 1]?.value;
      remove.disabled = !chosen && count <= 2;
    });
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
    savedView = undefined;
    saveButton.disabled = true;
    const query = new URLSearchParams();
    if (theme.value !== themeSelect.options[0].value)
      query.set('theme', theme.value);
    if (active.length) query.set('c', active.join(','));
    if (count > 2 && active.length < count) query.set('count', String(count));
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
    const address = useFragment
      ? location.pathname + (query.size ? selectionFragment + query : '')
      : location.pathname + (query.size ? '?' + query : '') + location.hash;
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
      if (focus)
        selects
          .slice(0, count)
          .find((select) => !select.value)
          ?.focus();
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
    const versionsById = new Map(
      data.versions.map((version) => [version.id, version]),
    );
    const selected = data.candidates.filter(({ id }) => active.includes(id));
    const measuresById = new Map(data.measures.map((m) => [m.id, m]));
    const complements = (reading?.complements ?? []).flatMap((complement) => {
      const version = versionsById.get(complement.versionId);
      const original = version && measuresById.get(version.measureId);
      if (!version || !original || !active.includes(original.candidate))
        return [];
      const { id, parentId, candidate, theme, revision } = original;
      return [
        {
          justification: complement.justification,
          version,
          measure: {
            ...version.snapshot,
            id,
            parentId,
            candidate,
            theme,
            revision,
          },
        },
      ];
    });
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
      const extra = complements.filter(
        ({ measure }) => measure.candidate === id,
      );
      const card = el('article', undefined, 'comparison-card'),
        header = el('header');
      header.append(el('p', candidate.party), el('h3', candidate.name));
      if (candidate.withdrawnOn)
        header.append(
          el('p', 'Candidature retirée le ' + date(candidate.withdrawnOn)),
        );
      const state = reading?.coverage[id];
      if (state && Object.hasOwn(coverageLabels, state))
        header.append(el('p', coverageLabels[state], 'compare-coverage'));
      const alert = reading?.alerts[id];
      if (alert) header.append(el('p', alert, 'compare-coverage'));
      if (items.length)
        header.append(
          el(
            'p',
            `${items.length} fiche${items.length === 1 ? '' : 's'}`,
            'comparison-count',
          ),
        );
      const body = el('details', undefined, 'comparison-body');
      body.open = true;
      body.append(el('summary', 'Propositions et sources'));
      if (items.length) {
        available++;
        for (const measure of items)
          body.append(
            measureCard(measure, data, true, 'h4', vByMeasure.get(measure.id)),
          );
      } else {
        const reviews =
          reading?.reviews.filter(({ candidate }) => candidate === id) ?? [];
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
              ? candidate.withdrawnOn
                ? 'Candidature retirée'
                : extra.length
                  ? 'Compléments documentaires'
                  : 'Position non documentée'
              : old
                ? 'Archive de 2022 disponible'
                : 'Aucune fiche dans le corpus',
          ),
          el(
            'p',
            subject
              ? candidate.withdrawnOn
                ? 'Le dossier du candidat conserve ses propositions et leurs dates.'
                : reviews.length
                  ? 'Les documents examinés figurent ci-dessous.'
                  : 'Aucune proposition reliée à cette question pour ce candidat.'
              : old
                ? 'Activez les archives pour consulter ce document avec son millésime.'
                : 'Le thème reste à renseigner pour ce candidat.',
          ),
        );
        for (const review of reviews) {
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
            body.append(details, el('p', review.locator));
          }
        }
      }
      for (const { measure, version, justification } of extra) {
        body.append(
          el('p', 'Complément · ' + justification, 'compare-complement'),
          measureCard(measure, data, true, 'h4', version),
        );
      }
      const footer = el('footer');
      footer.append(anchor('Dossier du candidat ↗', `/candidats/${id}/`));
      card.append(header, body, footer);
      card.id = 'comparaison-' + id;
      const jump = anchor(candidate.name, '#' + card.id);
      jump.addEventListener('click', (event) => {
        if (!location.hash.startsWith(selectionFragment)) return;
        event.preventDefault();
        card.tabIndex = -1;
        card.focus({ preventScroll: true });
        card.scrollIntoView({ block: 'start' });
      });
      jumps.append(jump);
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
      [...relevant, ...complements.map(({ measure }) => measure)].flatMap(
        (item) => item.sourceRefs.map((ref) => ref.sourceId),
      ),
    );
    const reviews = (reading?.reviews ?? []).filter(({ candidate }) =>
      active.includes(candidate),
    );
    for (const { sourceId } of reviews) sourceIds.add(sourceId);
    exportData = JSON.stringify(
      {
        corpusUpdated: data.meta.corpusUpdated,
        sourceCommit: form.dataset.revision ?? null,
        theme: themeId,
        candidates: active,
        includeArchives,
        measures: relevant,
        sources: data.sources.filter((source) => sourceIds.has(source.id)),
        ...(subject
          ? {
              question: subject.value,
              versions: [...vByMeasure.values()],
              complements,
              reviews,
              coverage: active.map((id) => ({
                candidate: id,
                withdrawnOn:
                  selected.find((c) => c.id === id)?.withdrawnOn ?? null,
                state: reading?.coverage[id] ?? null,
                alert: reading?.alerts[id] ?? null,
              })),
            }
          : {}),
      },
      null,
      2,
    );
    exportButton.disabled = false;
    savedView = {
      parameters: query,
      title: [
        subject?.text ?? theme.text,
        ...active.map(
          (id) => selected.find((candidate) => candidate.id === id)!.name,
        ),
      ].join(' · '),
    };
    saveButton.disabled = false;
    if (focus) heading.focus();
    feedback.textContent = `${available} candidature${available > 1 ? 's' : ''} renseignée${available > 1 ? 's' : ''} sur ${active.length} · ${relevant.length} fiche${relevant.length > 1 ? 's' : ''} · corpus du ${date(data.meta.corpusUpdated)}`;
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void render(true, 'push');
  });
  form.addEventListener('change', (event) => {
    selectionNote.hidden = true;
    if (event.target === third) count = third.checked ? 3 : 2;
    void render(false, 'push');
  });
  add.addEventListener('click', () => {
    if (count >= maxComparisonCandidates) return;
    count++;
    void render(false, 'push');
    selects[count - 1].focus();
  });
  slots.forEach(({ earlier, later, remove }, index) => {
    const move = (destination: number) => {
      [selects[index].value, selects[destination].value] = [
        selects[destination].value,
        selects[index].value,
      ];
      void render(false, 'push');
      selects[destination].focus();
    };
    earlier.addEventListener('click', () => move(index - 1));
    later.addEventListener('click', () => move(index + 1));
    remove.addEventListener('click', () => {
      const values = selects.slice(0, count).map((select) => select.value);
      values.splice(index, 1);
      count = Math.max(2, count - 1);
      selects.forEach((select, slot) => {
        select.value = values[slot] ?? '';
      });
      void render(false, 'push');
      selects[Math.min(index, count - 1)].focus();
    });
  });
  window.addEventListener('popstate', restore);
  saveButton.addEventListener('click', async () => {
    if (savedView)
      feedback.textContent = await saveView(
        'compare',
        savedView.parameters,
        savedView.title,
      );
  });
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
        const shared = new URL(location.pathname, location.origin);
        if (!savedView) return;
        shared.hash = selectionFragment + savedView.parameters;
        await navigator.clipboard.writeText(shared.href);
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
