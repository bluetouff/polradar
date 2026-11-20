import { catalogue } from './catalogue';
import { el, anchor, icon, download } from './ui';
import { filterEntries, exportCsv } from '../lib/features.mjs';
import type { SearchEntry } from '../lib/search';
const form = document.querySelector<HTMLFormElement>('#search-form')!,
  results = document.querySelector<HTMLElement>('#search-results')!,
  count = document.querySelector<HTMLElement>('#search-count')!;
const kinds: Record<string, string> = {
  question: 'Question de programme',
  mesure: 'Mesure',
  candidat: 'Candidat',
  theme: 'Thème',
  dossier: 'Dossier',
  source: 'Source',
  sondage: 'Sondage',
  evenement: 'Chronologie',
};
const selection = catalogue<SearchEntry>({
  form,
  results,
  count,
  load: async () => {
    const response = await fetch('/api/recherche.json', {
      credentials: 'omit',
      redirect: 'error',
    });
    if (!response.ok) throw Error('Index indisponible');
    return response.json() as Promise<SearchEntry[]>;
  },
  select: (entries, params) =>
    filterEntries(entries, Object.fromEntries(params)),
  card: (entry) => {
    const article = el('article', undefined, 'advanced-result');
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
      el('p', entry.text.slice(0, 220) + (entry.text.length > 220 ? '…' : '')),
    );
    article.append(symbol, body, el('span', '↗'));
    return article;
  },
});
async function exportSelection(format: 'csv' | 'json') {
  try {
    const rows = await selection();
    if (format === 'csv')
      download(
        exportCsv(rows),
        'text/csv;charset=utf-8',
        'polradar-recherche.csv',
      );
    else
      download(
        JSON.stringify(rows, null, 2),
        'application/json;charset=utf-8',
        'polradar-recherche.json',
      );
  } catch {
    count.textContent =
      'Export indisponible. Réessayez lorsque l’index sera accessible.';
  }
}
for (const format of ['csv', 'json'] as const)
  document
    .querySelector('#export-' + format)!
    .addEventListener('click', () => void exportSelection(format));
document.querySelector('#search-share')!.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    count.textContent = 'Lien de recherche copié.';
  } catch {
    count.textContent =
      'Copiez l’adresse de la page pour partager ces filtres.';
  }
});
