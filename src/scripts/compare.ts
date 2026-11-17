import type { Candidate, Engagement } from '../lib/data';
type Theme = { id: string; label: string; note: string };
type Source = { id: string; title: string; url: string };
type Corpus = {
  candidates: Candidate[];
  themes: Theme[];
  sources: Source[];
  engagements: Engagement[];
};
const form = document.querySelector<HTMLFormElement>('#compare-form')!;
const themeSelect =
  document.querySelector<HTMLSelectElement>('#compare-theme')!;
const archives = document.querySelector<HTMLInputElement>('#compare-archives')!;
const feedback = document.querySelector<HTMLElement>('#comparison-feedback')!;
const selects = [0, 1, 2].map((index) =>
  document.querySelector<HTMLSelectElement>(`#compare-candidate-${index}`)!,
);
const defaults = ['melenchon', 'philippe', 'retailleau'];
const scopeLabels: Record<string, string> = {
  campagne: 'Campagne 2027',
  parti: 'Projet de parti',
  orientation: 'Orientation',
  archive: 'Archive 2022',
};
function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function link(text: string, url: string) {
  const el = node('a', text);
  el.href = url;
  return el;
}
async function start() {
  const response = await fetch('/api/corpus.json', {
    credentials: 'omit',
    redirect: 'error',
  });
  if (!response.ok) throw new Error('corpus-unavailable');
  const corpus: Corpus = await response.json();
  const candidateIds = new Set(corpus.candidates.map((c) => c.id));
  const params = new URLSearchParams(location.search);
  const requested = [
    ...new Set(
      (params.get('c') || '').split(',').filter((id) => candidateIds.has(id)),
    ),
  ].slice(0, 3);
  const ids = requested.length >= 2 ? requested : defaults;
  const rawTheme = params.get('theme');
  if (corpus.themes.some((t) => t.id === rawTheme))
    themeSelect.value = rawTheme!;
  archives.checked = params.get('archives') === '1';
  const radio = form.querySelector<HTMLInputElement>(
    `input[name=count][value="${ids.length}"]`,
  )!;
  radio.checked = true;
  selects.forEach((select, i) => {
    select.value =
      ids[i] || corpus.candidates.find((c) => !ids.includes(c.id))!.id;
  });
  const count = () =>
    form.querySelector<HTMLInputElement>('input[name=count]:checked')!.value ===
    '2'
      ? 2
      : 3;
  const selected = () => selects.slice(0, count()).map((s) => s.value);
  function render() {
    if (
      count() === 3 &&
      selects.slice(0, 2).some((select) => select.value === selects[2].value)
    ) {
      selects[2].value = corpus.candidates.find(
        (candidate) =>
          !selects.slice(0, 2).some((select) => select.value === candidate.id),
      )!.id;
    }
    const active = selected();
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
    const theme = corpus.themes.find((t) => t.id === themeSelect.value)!;
    document.querySelector('#comparison-theme-title')!.textContent =
      theme.label;
    document.querySelector('#comparison-note')!.textContent = theme.note;
    const container = document.querySelector<HTMLElement>('#comparison-cards')!;
    container.dataset.count = String(count());
    container.replaceChildren();
    let available = 0;
    active.forEach((id) => {
      const candidate = corpus.candidates.find((c) => c.id === id)!;
      const raw = corpus.engagements.find(
        (e) => e.candidate === id && e.theme === theme.id,
      );
      const item =
        raw && (raw.scope !== 'archive' || archives.checked) ? raw : undefined;
      const card = node('article', undefined, 'comparison-card');
      const header = node('header');
      header.append(node('p', candidate.party), node('h3', candidate.name));
      card.append(header);
      const body = node('div', undefined, 'comparison-body');
      const footer = node('footer');
      if (item) {
        available++;
        body.append(
          node(
            'span',
            scopeLabels[item.scope],
            item.scope === 'archive' ? 'tag archive' : 'tag',
          ),
          node('h4', item.title),
        );
        const ul = node('ul');
        item.bullets.forEach((b) => ul.append(node('li', b)));
        body.append(ul);
        if (item.note) {
          const details = node('details');
          details.append(
            node('summary', 'Contexte & précisions'),
            node('p', item.note),
          );
          body.append(details);
        }
        footer.append(
          link('Lire la fiche complète ↗', `/engagements/${item.id}/`),
        );
        const ulSources = node('ul', undefined, 'source-links compact');
        item.sources.forEach((key) => {
          const source = corpus.sources.find((s) => s.id === key);
          if (!source) return;
          const url = new URL(source.url);
          if (url.protocol !== 'https:' || url.username || url.password) return;
          const li = node('li');
          const a = link(`${source.title} ↗`, url.href);
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          li.append(a);
          ulSources.append(li);
        });
        footer.append(
          ulSources,
          node(
            'p',
            `${item.edition} · consulté le ${item.checked}`,
            'small muted',
          ),
        );
      } else {
        body.append(
          node('span', 'À documenter', 'tag'),
          node('h4', raw ? 'Une référence ancienne' : 'Fiche à compléter'),
          node(
            'p',
            raw
              ? 'Une archive de 2022 est disponible. Activez les archives pour la consulter avec son millésime.'
              : 'Notre corpus ne contient pas encore de fiche sur ce thème pour cette candidature. Cela ne démontre pas une absence de proposition.',
          ),
        );
        footer.append(
          link('Consulter le dossier ↗', `/candidats/${candidate.id}/`),
        );
      }
      card.append(body, footer);
      container.append(card);
    });
    feedback.textContent = `${available} fiche${available > 1 ? 's' : ''} disponible${available > 1 ? 's' : ''} sur ${count()} · corpus du 16 novembre 2026`;
    const url = new URL(location.href);
    url.search = new URLSearchParams({
      theme: theme.id,
      c: active.join(','),
      archives: archives.checked ? '1' : '0',
    }).toString();
    history.replaceState(null, '', url);
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    render();
  });
  form.addEventListener('change', render);
  selects.forEach((s) => s.addEventListener('change', render));
  document
    .querySelector('#comparison-share')!
    .addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        feedback.textContent = 'Lien de comparaison copié.';
      } catch {
        feedback.textContent =
          'Copiez l’adresse de cette page : elle conserve votre comparaison.';
      }
    });
  document
    .querySelector('#comparison-print')!
    .addEventListener('click', () => window.print());
  render();
}
start().catch(() => {
  feedback.textContent =
    'Le corpus interactif n’a pas pu être chargé. La comparaison initiale et les liens vers les dossiers restent consultables.';
});
