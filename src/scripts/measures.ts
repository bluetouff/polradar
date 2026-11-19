import { corpus, measureCard } from './ui';
import { filterEntries } from '../lib/features.mjs';
const form = document.querySelector<HTMLFormElement>('#measure-filters')!;
const results = document.querySelector<HTMLElement>('#measure-results')!,
  count = document.querySelector<HTMLElement>('#measure-count')!;
async function start() {
  const data = await corpus();
  const params = new URLSearchParams(location.hash.slice(1));
  for (const name of ['candidate', 'theme', 'q']) {
    const input = form.elements.namedItem(name) as
      HTMLInputElement | HTMLSelectElement;
    if (params.has(name)) input.value = params.get(name)!;
  }
  (form.elements.namedItem('archives') as HTMLInputElement).checked =
    params.get('archives') === '1';
  function render() {
    const values = Object.fromEntries(new FormData(form).entries());
    const candidate = String(values.candidate || ''),
      theme = String(values.theme || ''),
      q = String(values.q || '').slice(0, 200),
      archives = values.archives === '1' ? '1' : '0';
    const filtered = filterEntries(
      data.measures.map((measure) => ({
        ...measure,
        text: `${measure.partyAuthor ?? data.candidates.find((candidate) => candidate.id === measure.candidate)!.name} ${data.themes.find((theme) => theme.id === measure.theme)!.label} ${measure.description}`,
      })),
      { candidate, theme, q, archives },
    );
    results.replaceChildren(
      ...filtered.map((measure) => measureCard(measure, data)),
    );
    count.textContent = `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`;
    const query = new URLSearchParams();
    if (candidate) query.set('candidate', candidate);
    if (theme) query.set('theme', theme);
    if (q) query.set('q', q);
    if (archives === '1') query.set('archives', '1');
    history.replaceState(
      null,
      '',
      `${location.pathname}${query.size ? '#' + query : ''}`,
    );
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    render();
  });
  form.addEventListener('change', (event) => {
    if (event.target instanceof HTMLSelectElement) render();
  });
  form.addEventListener('input', (event) => {
    if ((event.target as HTMLElement).tagName === 'INPUT') render();
  });
  addEventListener('hashchange', () => {
    const p = new URLSearchParams(location.hash.slice(1));
    (form.elements.namedItem('theme') as HTMLSelectElement).value =
      p.get('theme') || '';
    render();
  });
  render();
}
start().catch(() => {
  count.textContent =
    'Les filtres n’ont pas pu être chargés. Les fiches ci-dessous restent consultables.';
});
