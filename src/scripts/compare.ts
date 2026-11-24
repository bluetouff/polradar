import { corpus, el, anchor, measureCard, renderMetricPlots, date } from './ui';
import { metricGroups } from '../lib/features.mjs';
const form = document.querySelector<HTMLFormElement>('#compare-form')!,
  themeSelect = document.querySelector<HTMLSelectElement>('#compare-theme')!,
  archives = document.querySelector<HTMLInputElement>('#compare-archives')!,
  feedback = document.querySelector<HTMLElement>('#comparison-feedback')!,
  selects = [0, 1, 2].map((index) =>
    document.querySelector<HTMLSelectElement>(`#compare-candidate-${index}`)!,
  );
function start() {
  const valid = new Set(
    Array.from(selects[0].options, (option) => option.value).filter(Boolean),
  );
  const params = new URLSearchParams(location.search);
  const ids = [
    ...new Set(
      (params.get('c') || '').split(',').filter((id) => valid.has(id)),
    ),
  ].slice(0, 3);
  if (
    Array.from(themeSelect.options).some(
      (option) => option.value === params.get('theme'),
    )
  )
    themeSelect.value = params.get('theme')!;
  archives.checked = params.get('archives') === '1';
  form.querySelector<HTMLInputElement>(
    `input[name=count][value="${ids.length === 3 || params.get('count') === '3' ? 3 : 2}"]`,
  )!.checked = true;
  selects.forEach((select, index) => {
    select.value = ids[index] ?? '';
  });
  const count = () =>
    form.querySelector<HTMLInputElement>('input[name=count]:checked')!.value ===
    '2'
      ? 2
      : 3;
  let generation = 0;
  async function render() {
    const ticket = ++generation;
    const active = [
      ...new Set(
        selects
          .slice(0, count())
          .map((select) => select.value)
          .filter(Boolean),
      ),
    ];
    selects[2].parentElement!.hidden = count() === 2;
    selects.forEach((select, index) =>
      Array.from(select.options).forEach((option) => {
        option.disabled =
          !!option.value &&
          index < count() &&
          active.includes(option.value) &&
          select.value !== option.value;
      }),
    );
    const theme = themeSelect.selectedOptions[0];
    document.querySelector('#comparison-theme-title')!.textContent = theme.text;
    document.querySelector('#comparison-note')!.textContent =
      theme.dataset.note || '';
    const container = document.querySelector<HTMLElement>('#comparison-cards')!;
    container.dataset.count = String(count());
    container.replaceChildren();
    const query = new URLSearchParams();
    if (theme.value !== themeSelect.options[0].value)
      query.set('theme', theme.value);
    if (active.length) query.set('c', active.join(','));
    if (count() === 3 && active.length < 3) query.set('count', '3');
    if (archives.checked) query.set('archives', '1');
    history.replaceState(
      null,
      '',
      location.pathname + (query.size ? '?' + query : ''),
    );
    if (active.length < 2) {
      document.querySelector('#comparison-metrics')!.replaceChildren();
      feedback.textContent = active.length
        ? 'Choisissez une deuxième candidature.'
        : 'Choisissez deux candidatures à comparer.';
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
    const relevant = data.measures.filter(
      (measure) =>
        active.includes(measure.candidate) &&
        measure.theme === theme.value &&
        (measure.scope !== 'archive' || archives.checked),
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
          body.append(measureCard(measure, data, true, 'h4'));
      } else {
        const old = data.measures.some(
          (measure) =>
            measure.candidate === id &&
            measure.theme === theme.value &&
            measure.scope === 'archive',
        );
        body.append(
          el('span', 'À renseigner', 'tag'),
          el(
            'h4',
            old ? 'Archive de 2022 disponible' : 'Aucune fiche dans le corpus',
          ),
          el(
            'p',
            old
              ? 'Activez les archives pour consulter ce document avec son millésime.'
              : 'Le thème reste à renseigner pour ce candidat.',
          ),
        );
      }
      const footer = el('footer');
      footer.append(anchor('Dossier du candidat ↗', `/candidats/${id}/`));
      card.append(header, body, footer);
      container.append(card);
    }
    renderMetricPlots(
      document.querySelector<HTMLElement>('#comparison-metrics')!,
      metricGroups(relevant, data.candidates),
    );
    feedback.textContent = `${available} candidature${available > 1 ? 's' : ''} renseignée${available > 1 ? 's' : ''} sur ${active.length} · ${relevant.length} fiche${relevant.length > 1 ? 's' : ''} · corpus du ${date(data.meta.corpusUpdated)}`;
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    render();
  });
  form.addEventListener('change', render);
  selects.forEach((select) => select.addEventListener('change', render));
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
  render();
}
start();
