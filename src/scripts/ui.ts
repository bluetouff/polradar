import { collectiveLabel } from '../lib/attribution.mjs';
import { sameSentence, sourceCountLabel } from '../lib/measure-text';
import { iconPaths } from '../lib/icons.mjs';
import type { Corpus, Measure } from '../lib/data';
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function anchor(text: string, url: string) {
  const node = el('a', text);
  node.href = url;
  return node;
}
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  text?: string,
) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes))
    node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
export function icon(name: string) {
  const node = svg('svg', {
    viewBox: '0 0 24 24',
    class: 'icon',
    'aria-hidden': 'true',
  });
  node.append(
    svg('path', {
      d: iconPaths[name as keyof typeof iconPaths] || iconPaths.source,
    }),
  );
  return node;
}
export const date = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeZone: 'Europe/Paris',
  }).format(new Date(`${value}T12:00:00Z`));
export const number = (value: number) => value.toLocaleString('fr-FR');
export async function publicData<T>(
  path:
    | '/data/choix-suivi.json'
    | '/data/enquetes.json'
    | '/api/corpus.json'
    | '/api/recherche.json',
): Promise<T> {
  const response = await fetch(path, {
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw Error('Données indisponibles');
  const stamp = document.querySelector<HTMLMetaElement>(
    `meta[name="polradar-data"][data-path="${path}"]`,
  );
  if (!stamp) return response.json();
  const buffer = await response.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  const hex = Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  if (hex !== stamp.content) throw Error('Édition des données différente');
  return JSON.parse(new TextDecoder().decode(buffer)) as T;
}
let pending: Promise<Corpus> | undefined;
export function corpus(): Promise<Corpus> {
  if (!pending)
    pending = publicData<Corpus>('/api/corpus.json').catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
export function download(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = anchor('', url);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function measureCard(
  measure: Measure,
  data: Corpus,
  compact = false,
  level: 'h3' | 'h4' = 'h3',
  version?: Corpus['versions'][number],
) {
  const candidate = data.candidates.find(
      (row) => row.id === measure.candidate,
    )!,
    theme = data.themes.find((row) => row.id === measure.theme)!;
  const article = el(
    'article',
    undefined,
    compact ? 'measure-row compact' : 'measure-row',
  );
  const collective = collectiveLabel(measure);
  article.dataset.scope = measure.scope;
  const symbol = anchor('', `/themes/${theme.id}/`);
  symbol.className = 'measure-symbol';
  symbol.setAttribute('aria-label', theme.label);
  symbol.append(icon(theme.id));
  const content = el('div', undefined, 'measure-content'),
    meta = el('div', undefined, 'measure-meta');
  const labels: Record<string, string> = {
    campagne: 'Campagne 2027',
    parti: 'Projet de parti',
    orientation: 'Orientation',
    archive: 'Archive 2022',
  };
  meta.append(
    collective
      ? el('strong', collective)
      : anchor(candidate.name, `/candidats/${candidate.id}/`),
    el(
      'span',
      labels[measure.scope] +
        (!collective && candidate.withdrawnOn && measure.scope !== 'archive'
          ? ' · candidature retirée'
          : ''),
      measure.scope === 'archive' ? 'tag archive' : 'tag',
    ),
  );
  const h = el(level);
  const measurePath = `/mesures/${measure.id}/`;
  const passage = version ? '#version-' + version.number : '';
  h.append(anchor(measure.title, measurePath + passage));
  content.append(meta, h);
  if (
    (!compact || version) &&
    !sameSentence(measure.title, measure.description)
  )
    content.append(el('p', measure.description));
  const quantities = el('div', undefined, 'measure-quantities');
  measure.metrics.forEach((metric) => {
    const span = el('span');
    span.append(
      el('b', number(metric.value)),
      document.createTextNode(` ${metric.unit}`),
    );
    quantities.append(span);
  });
  measure.amounts.forEach((amount) => {
    const span = el('span');
    span.append(
      el('b', `${number(amount.value)} ${amount.unit}`),
      document.createTextNode(
        ` / ${amount.period} ${amount.basis === 'non-applicable' ? '' : amount.basis}`,
      ),
    );
    quantities.append(span);
  });
  const links = el('div', undefined, 'measure-links'),
    source = anchor(
      sourceCountLabel(measure.sourceRefs),
      measurePath + (passage || '#sources'),
    ),
    history = anchor(
      `${measure.revision} version${measure.revision > 1 ? 's' : ''}`,
      `/historique/?mesure=${measure.id}`,
    );
  source.prepend(icon('source'));
  history.prepend(icon('historique'));
  links.append(source, history);
  if (version) {
    const citations = el('details', undefined, 'q-citations');
    citations.append(el('summary', sourceCountLabel(measure.sourceRefs)));
    for (const ref of measure.sourceRefs) {
      const original = data.sources.find(({ id }) => id === ref.sourceId);
      if (!original) continue;
      const entry = el('div');
      const link = anchor(
        original.title,
        ref.fragment
          ? original.url.split('#')[0] + '#' + ref.fragment
          : original.url,
      );
      link.rel = 'noreferrer';
      entry.append(link, el('p', ref.locator));
      citations.append(entry);
    }
    source.replaceWith(citations);
  }
  if (quantities.childElementCount) content.append(quantities);
  content.append(links);
  article.append(symbol, content);
  return article;
}
export function renderMetricPlots(
  container: HTMLElement,
  groups: Array<{
    key: string;
    label: string;
    unit: string;
    values: Array<{ name: string; value: number; measureId: string }>;
  }>,
) {
  container.replaceChildren();
  for (const group of groups) {
    const max =
      Math.ceil(Math.max(...group.values.map((row) => row.value)) / 10) * 10 ||
      1;
    const panel = el('section', undefined, 'metric-panel'),
      header = el('header');
    header.append(
      icon('sondages'),
      el('h3', group.label),
      el('span', group.unit),
    );
    const scale = el('div', undefined, 'metric-scale');
    scale.append(el('span', '0'), el('span', `${number(max)} ${group.unit}`));
    panel.append(header, scale);
    group.values.forEach((row) => {
      const link = anchor('', `/mesures/${row.measureId}/`);
      link.className = 'metric-row';
      const chart = svg('svg', {
        viewBox: '0 0 320 28',
        preserveAspectRatio: 'none',
        'aria-hidden': 'true',
      });
      chart.append(
        svg('path', { class: 'metric-track', d: 'M5 14H315' }),
        svg('path', {
          class: 'metric-line',
          d: `M5 14H${5 + (row.value / max) * 310}`,
        }),
        svg('path', {
          class: 'metric-dot',
          d: `M${5 + (row.value / max) * 310} 14h0`,
        }),
      );
      link.append(el('span', row.name), chart, el('strong', number(row.value)));
      panel.append(link);
    });
    container.append(panel);
  }
}
