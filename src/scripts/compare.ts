import { corpus, el, anchor, measureCard, renderMetricPlots, date } from './ui';
import { metricGroups } from '../lib/features.mjs';
const form = document.querySelector<HTMLFormElement>('#compare-form')!,
  themeSelect = document.querySelector<HTMLSelectElement>('#compare-theme')!,
  archives = document.querySelector<HTMLInputElement>('#compare-archives')!,
  feedback = document.querySelector<HTMLElement>('#comparison-feedback')!,
  selects = [0, 1, 2].map((index) =>
    document.querySelector<HTMLSelectElement>(`#compare-candidate-${index}`)!,
  );
const defaults = ['melenchon', 'philippe', 'retailleau'];
async function start() {
  const data = await corpus(),
    valid = new Set(data.candidates.map((candidate) => candidate.id)),
    params = new URLSearchParams(location.search);
  const requested = [
      ...new Set(
        (params.get('c') || '').split(',').filter((id) => valid.has(id)),
      ),
    ].slice(0, 3),
    ids = requested.length >= 2 ? requested : defaults;
  if (data.themes.some((theme) => theme.id === params.get('theme')))
    themeSelect.value = params.get('theme')!;
  archives.checked = params.get('archives') === '1';
  form.querySelector<HTMLInputElement>(
    `input[name=count][value="${ids.length}"]`,
  )!.checked = true;
  selects.forEach((select, index) => {
    select.value =
      ids[index] ||
      data.candidates.find((candidate) => !ids.includes(candidate.id))!.id;
  });
  const count = () =>
    form.querySelector<HTMLInputElement>('input[name=count]:checked')!.value ===
    '2'
      ? 2
      : 3;
  function render() {
    if (
      count() === 3 &&
      selects.slice(0, 2).some((select) => select.value === selects[2].value)
    )
      selects[2].value = data.candidates.find(
        (candidate) =>
          !selects.slice(0, 2).some((select) => select.value === candidate.id),
      )!.id;
    const active = selects.slice(0, count()).map((select) => select.value);
    if (new Set(active).size !== active.length) {
      feedback.textContent = 'Choisissez des candidatures différentes.';
      return;
    }
    selects[2].parentElement!.hidden = count() === 2;
    selects.forEach((select, index) =>
      Array.from(select.options).forEach((option) => {
        option.disabled =
          index < count() &&
          active.includes(option.value) &&
          select.value !== option.value;
      }),
    );
    const theme = data.themes.find((theme) => theme.id === themeSelect.value)!;
    document.querySelector('#comparison-theme-title')!.textContent =
      theme.label;
    document.querySelector('#comparison-note')!.textContent = theme.note;
    const relevant = data.measures.filter(
      (measure) =>
        active.includes(measure.candidate) &&
        measure.theme === theme.id &&
        (measure.scope !== 'archive' || archives.checked),
    );
    const container = document.querySelector<HTMLElement>('#comparison-cards')!;
    container.dataset.count = String(count());
    container.replaceChildren();
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
            measure.theme === theme.id &&
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
    feedback.textContent = `${available} candidature${available > 1 ? 's' : ''} renseignée${available > 1 ? 's' : ''} sur ${count()} · ${relevant.length} fiche${relevant.length > 1 ? 's' : ''} · corpus du ${date(data.meta.corpusUpdated)}`;
    history.replaceState(
      null,
      '',
      `/comparer/?${new URLSearchParams({ theme: theme.id, c: active.join(','), archives: archives.checked ? '1' : '0' })}`,
    );
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
start().catch(() => {
  feedback.textContent =
    'Le corpus interactif n’a pas pu être chargé. La comparaison initiale reste consultable.';
});
