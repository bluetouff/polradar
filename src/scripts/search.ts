import { el, anchor, icon, download } from './ui';
import { filterEntries, exportCsv } from '../lib/features.mjs';
import type { SearchEntry } from '../lib/search';
const form = document.querySelector<HTMLFormElement>('#search-form')!,
  results = document.querySelector<HTMLElement>('#search-results')!,
  count = document.querySelector<HTMLElement>('#search-count')!;
const kinds: Record<string, string> = {
  mesure: 'Mesure',
  candidat: 'Candidat',
  theme: 'Thème',
  dossier: 'Dossier',
  source: 'Source',
  sondage: 'Sondage',
  evenement: 'Chronologie',
};
async function start() {
  const response = await fetch('/api/recherche.json', {
    credentials: 'omit',
    redirect: 'error',
  });
  if (!response.ok) throw Error('Index indisponible');
  const entries: SearchEntry[] = await response.json();
  let filtered: SearchEntry[] = [];
  const query = new URLSearchParams(location.hash.slice(1));
  for (const name of ['q', 'candidate', 'theme', 'type', 'year']) {
    const input = form.elements.namedItem(name) as
      HTMLInputElement | HTMLSelectElement;
    if (query.has(name)) input.value = query.get(name)!.slice(0, 200);
  }
  (form.elements.namedItem('archives') as HTMLInputElement).checked =
    query.get('archives') === '1';
  function render() {
    const values = Object.fromEntries(new FormData(form).entries());
    const filters = {
      q: String(values.q || '').slice(0, 200),
      candidate: String(values.candidate || ''),
      theme: String(values.theme || ''),
      type: String(values.type || ''),
      year: String(values.year || ''),
      archives: values.archives === '1' ? '1' : '0',
    };
    filtered = filterEntries(entries, filters);
    results.replaceChildren();
    for (const entry of filtered) {
      const article = el('article', undefined, 'advanced-result');
      article.dataset.search = `${entry.title} ${entry.text}`;
      const symbol = el('span', undefined, 'result-symbol');
      symbol.append(
        icon(
          entry.type === 'mesure'
            ? entry.theme
            : entry.type === 'sondage'
              ? 'sondages'
              : entry.type === 'candidat'
                ? 'people'
                : entry.type === 'source'
                  ? 'source'
                  : entry.type === 'evenement'
                    ? 'clock'
                    : 'layers',
        ),
      );
      const body = el('div'),
        h2 = el('h2'),
        link = anchor(entry.title, entry.url);
      if (entry.url.startsWith('https:')) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      h2.append(link);
      body.append(
        el(
          'p',
          `${kinds[entry.type]}${entry.year ? ' · ' + entry.year : ''}`,
          'result-meta',
        ),
        h2,
        el(
          'p',
          entry.text.slice(0, 220) + (entry.text.length > 220 ? '…' : ''),
        ),
      );
      article.append(symbol, body, el('span', '↗'));
      results.append(article);
    }
    if (!filtered.length)
      results.append(
        el('p', 'Aucun résultat pour ces filtres.', 'empty-results'),
      );
    count.textContent = `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value && !(key === 'archives' && value === '0'))
        params.set(key, value);
    history.replaceState(
      null,
      '',
      `${location.pathname}${params.size ? '#' + params : ''}`,
    );
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    render();
  });
  form.addEventListener('change', render);
  form.addEventListener('input', render);
  form.addEventListener('reset', () => setTimeout(render, 0));
  document
    .querySelector('#export-csv')!
    .addEventListener('click', () =>
      download(
        exportCsv(filtered),
        'text/csv;charset=utf-8',
        'polradar-recherche.csv',
      ),
    );
  document
    .querySelector('#export-json')!
    .addEventListener('click', () =>
      download(
        JSON.stringify(filtered, null, 2),
        'application/json;charset=utf-8',
        'polradar-recherche.json',
      ),
    );
  document
    .querySelector('#search-share')!
    .addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        count.textContent = 'Lien de recherche copié.';
      } catch {
        count.textContent =
          'Copiez l’adresse de la page pour partager ces filtres.';
      }
    });
  render();
}
start().catch(() => {
  count.textContent =
    'Les filtres n’ont pas pu être chargés. L’index ci-dessous reste consultable.';
});
