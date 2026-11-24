import type { studioPublication } from '../lib/studio';
import { csvValue } from '../lib/features.mjs';
import { isPublicSourceUrl } from '../lib/source-url.mjs';
import { escapeHtml } from '../lib/escape-html.mjs';
type Publication = ReturnType<typeof studioPublication>;
const node = <T extends HTMLElement>(id: string) =>
  document.getElementById('studio-' + id) as T;
const input = (id: string) => node<HTMLSelectElement>(id);
const family = input('family'),
  item = input('item'),
  shape = input('shape'),
  width = input('width'),
  mode = input('mode'),
  caption = node<HTMLInputElement>('caption');
const sets = [...item.querySelectorAll('optgroup')];
const choices = new Map<string, { subject: string; drawing: boolean }>();
for (const set of sets)
  for (const opt of set.children)
    choices.set((opt as HTMLOptionElement).value, {
      subject: set.dataset.family!,
      drawing: opt.hasAttribute('data-drawing'),
    });
let selection: Publication | undefined;
let currentRequest: AbortController | undefined;
let currentSvg = '',
  currentImage = '';
let publishedCode = '';
function feedback(text: string) {
  node('status').textContent = text;
}
function dataUri(bytes: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Fichier illisible'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(bytes);
  });
}
function safeLinks(data: Publication) {
  if (
    !isPublicSourceUrl(data.pageUrl) ||
    !isPublicSourceUrl(data.liveUrl) ||
    new URL(data.pageUrl).origin !== new URL(data.liveUrl).origin ||
    !data.graphic.sources.every((s) => isPublicSourceUrl(s.url))
  )
    throw Error('Références invalides');
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text: string) {
  const e = document.createElement(tag);
  e.textContent = text;
  return e;
}
const publicLinks = (data: Publication) => [
  ...new Map(data.graphic.sources.map((s) => [s.url, s])).values(),
];
function updateTable(data: Publication) {
  const details = element('details', '');
  details.append(element('summary', 'Lire les données en tableau'));
  node('table').replaceChildren(details);
  details.addEventListener('toggle', () => {
    if (details.open && !details.querySelector('table'))
      fillTable(details, data);
  });
}
function fillTable(details: HTMLDetailsElement, data: Publication) {
  const scroll = element('div', '');
  scroll.className = 'studio-scroll';
  const table = element('table', '');
  const thead = table.createTHead();
  const header = thead.insertRow();
  for (const column of data.columns) {
    const th = element('th', column);
    th.scope = 'col';
    header.append(th);
  }
  const body = table.createTBody();
  for (const row of data.rows) {
    const tr = body.insertRow();
    for (const cell of row) {
      const td = tr.insertCell();
      if (typeof cell === 'string' && isPublicSourceUrl(cell)) {
        const a = element('a', 'Document');
        a.href = cell;
        a.rel = 'noreferrer';
        td.append(a);
      } else td.textContent = cell === null ? 'Non renseigné' : String(cell);
    }
  }
  scroll.append(table);
  details.append(scroll);
}
function dimensions(data: Publication) {
  const ratio =
    (
      { carre: 1, vertical: 4 / 5, horizontal: 16 / 9 } as Record<
        string,
        number
      >
    )[shape.value] ?? data.graphic.width / data.graphic.height;
  const w = Number(width.value);
  return [w, Math.round(w / ratio)];
}
function figure(
  data: Publication,
  image: string,
  live: boolean,
  standalone = false,
) {
  const [w, h] = dimensions(data);
  const alt = live
    ? 'Graphique actualisé de Polradar. La source et la méthode figurent dans le dossier.'
    : data.graphic.alt;
  const ref = live
    ? new URL('/studio/#' + data.id, data.pageUrl).href
    : data.pageUrl;
  const sources = live
    ? []
    : publicLinks(data).map(
        (s) =>
          '<a rel="noreferrer" href="' +
          escapeHtml(s.url) +
          '">' +
          escapeHtml(s.label) +
          '</a>',
      );
  const links = [
    '<a rel="noreferrer" href="' +
      escapeHtml(ref) +
      '">Polradar · données et méthode</a>',
    ...(live ? [] : [escapeHtml(data.graphic.dateLabel)]),
    ...sources,
  ];
  const credits =
    'Graphique Polradar (bluetouff) · <a rel="noreferrer" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · <a rel="noreferrer" href="https://polradar.fr/licences/">Conditions de la base et des sources</a>';
  const description =
    '<figcaption>' +
    (caption.checked ? links.join(' · ') + '<br>' : '') +
    credits +
    '</figcaption>';
  return (
    '<figure><img src="' +
    escapeHtml(image) +
    '" alt="' +
    escapeHtml(alt) +
    '" width="' +
    w +
    '" height="' +
    h +
    '"' +
    (standalone
      ? ''
      : ' style="max-width:100%;height:auto;aspect-ratio:' +
        w +
        '/' +
        h +
        ';object-fit:contain"') +
    ' referrerpolicy="no-referrer">' +
    description +
    '</figure>'
  );
}
let rendering = 0;
async function refresh() {
  const ticket = ++rendering;
  const data = selection;
  if (!data) return;
  const [w, h] = dimensions(data);
  const xml = new DOMParser().parseFromString(
    data.graphic.svg,
    'image/svg+xml',
  );
  const root = xml.documentElement;
  // All drawings come from local build-time renderers. Only serialize passive SVG primitives.
  const primitives = new Set([
    'svg',
    'title',
    'desc',
    'metadata',
    'g',
    'rect',
    'path',
    'text',
    'tspan',
    'defs',
    'pattern',
    'line',
    'circle',
    'polyline',
    'polygon',
    'linearGradient',
    'stop',
  ]);
  for (const n of [root, ...root.querySelectorAll('*')]) {
    if (
      n.namespaceURI !== 'http://www.w3.org/2000/svg' ||
      !primitives.has(n.localName)
    )
      throw Error('Image non prise en charge');
    for (const a of n.attributes) {
      if (
        /^on/i.test(a.name) ||
        ['href', 'src', 'style'].includes(a.localName) ||
        (/url\s*\(/i.test(a.value) && !/^url\(#[a-zA-Z0-9_-]+\)$/.test(a.value))
      )
        throw Error('Référence SVG non autorisée');
    }
  }
  root.setAttribute('width', String(w));
  root.setAttribute('height', String(h));
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const svg = new XMLSerializer().serializeToString(root);
  const image = await dataUri(new Blob([svg], { type: 'image/svg+xml' }));
  if (ticket !== rendering || selection !== data) return;
  currentSvg = svg;
  currentImage = image;
  const preview = node<HTMLImageElement>('img');
  preview.src = image;
  preview.width = w;
  preview.height = h;
  preview.alt = data.graphic.alt;
  publishedCode = figure(
    data,
    mode.value === 'actualisee' ? data.liveUrl : image,
    mode.value === 'actualisee',
  );
  node<HTMLTextAreaElement>('code').value = publishedCode;
  node('mode-note').textContent =
    mode.value === 'actualisee'
      ? 'Le code charge la dernière édition de cette série depuis Polradar. L’aperçu et les fichiers ci-contre correspondent à l’édition choisie.'
      : 'Le code contient cette image. La publication reste identique et fonctionne hors ligne.';
  node('formats').hidden = false;
  node('copy').removeAttribute('disabled');
}
function renderSelection(data: Publication) {
  node('proof').hidden = false;
  node('prompt').hidden = true;
  node('title').textContent = data.graphic.title;
  node('date').textContent = data.graphic.dateLabel;
  const list = node('sources');
  list.replaceChildren(
    ...publicLinks(data).map((s) => {
      const a = element('a', s.label);
      a.href = s.url;
      a.rel = 'noreferrer';
      const li = element('li', '');
      li.append(a);
      return li;
    }),
  );
  node<HTMLAnchorElement>('page').href = data.pageUrl;
  updateTable(data);
}
async function select(id: string) {
  const choice = choices.get(id);
  if (!choice) return;
  const { subject, drawing } = choice;
  family.value = subject;
  const group = sets.find((g) => g.dataset.family === subject)!;
  item.replaceChildren(group);
  item.value = id;
  currentRequest?.abort();
  const request = new AbortController();
  currentRequest = request;
  selection = undefined;
  rendering++;
  currentSvg = '';
  currentImage = '';
  publishedCode = '';
  node<HTMLTextAreaElement>('code').value = '';
  node('copy').setAttribute('disabled', '');
  node('formats').hidden = true;
  feedback('Chargement du graphique…');
  try {
    const response = await fetch(
      drawing
        ? '/graphiques/studio/' + encodeURIComponent(id) + '.svg'
        : '/studio/donnees/' + encodeURIComponent(id) + '.json',
      {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: request.signal,
      },
    );
    if (!response.ok) throw Error('Édition indisponible');
    let data: Publication;
    if (drawing) {
      const xml = new DOMParser().parseFromString(
        await response.text(),
        'image/svg+xml',
      );
      const metadata = xml.documentElement.querySelector(
        ':scope > metadata#studio-data',
      );
      if (!metadata?.textContent) throw Error('Données de l’édition absentes');
      data = JSON.parse(metadata.textContent);
      metadata.remove();
      data.graphic.svg = new XMLSerializer().serializeToString(
        xml.documentElement,
      );
    } else data = await response.json();
    if (data.id !== id) throw Error('Identifiant invalide');
    safeLinks(data);
    if (request.signal.aborted) return;
    selection = data;
    await refresh();
    if (request.signal.aborted) return;
    renderSelection(data);
    feedback('');
  } catch (e) {
    if (!request.signal.aborted) {
      selection = undefined;
      node('proof').hidden = true;
      node('prompt').hidden = false;
      feedback(
        'Ce graphique est indisponible. Rechargez la page ou choisissez une autre série.',
      );
    }
  }
}
function navigate(id: string) {
  if (!choices.has(id)) return;
  const url = new URL(location.href);
  url.hash = id;
  history.replaceState(null, '', url);
  void select(id);
}
function hash() {
  return location.hash.slice(1);
}
family.addEventListener('change', () => {
  const group = sets.find((g) => g.dataset.family === family.value)!;
  if (group.children.length === 1) {
    navigate((group.firstElementChild as HTMLOptionElement).value);
    return;
  }
  currentRequest?.abort();
  selection = undefined;
  rendering++;
  currentSvg = '';
  currentImage = '';
  publishedCode = '';
  node<HTMLTextAreaElement>('code').value = '';
  node('copy').setAttribute('disabled', '');
  node('formats').hidden = true;
  const placeholder = element('option', 'Choisissez une série');
  placeholder.value = '';
  placeholder.disabled = true;
  item.replaceChildren(placeholder, group);
  item.value = '';
  node('proof').hidden = true;
  node('prompt').hidden = false;
  const url = new URL(location.href);
  url.hash = '';
  history.replaceState(null, '', url);
  feedback('');
});
item.addEventListener('change', () => navigate(item.value));
window.addEventListener(
  'hashchange',
  () => void select(choices.has(hash()) ? hash() : 'economie-inflation'),
);
for (const control of [shape, width, mode, caption])
  control.addEventListener('change', () => {
    void refresh().catch(() =>
      feedback('Cette édition ne peut pas être exportée.'),
    );
  });
node('copy').addEventListener('click', async () => {
  if (!publishedCode) return;
  try {
    await navigator.clipboard.writeText(publishedCode);
    feedback('Code copié.');
  } catch {
    node<HTMLTextAreaElement>('code').select();
    feedback('Code sélectionné. Utilisez la commande Copier du navigateur.');
  }
});
function save(blob: Blob, suffix: string, id: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'polradar-' + id + '.' + suffix;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function csv(data: Publication) {
  const field = (v: string | number | null) =>
    typeof v === 'number' ||
    (typeof v === 'string' && /^-\d+(?:\.\d+)?$/.test(v))
      ? String(v)
      : csvValue(v);
  return (
    '\uFEFF' +
    [
      [...data.columns, 'Préparation', 'Conditions de réutilisation'],
      ...data.rows.map((r) => [...r, 'Polradar', data.rights.policy]),
    ]
      .map((r) => r.map(field).join(';'))
      .join('\r\n') +
    '\r\n'
  );
}
async function download(format: string) {
  const data = selection;
  if (!data || !currentImage) return;
  const slug = data.id + '-' + data.edition.slice(0, 12);
  const image = currentImage;
  if (format === 'svg')
    save(new Blob([currentSvg], { type: 'image/svg+xml' }), 'svg', slug);
  if (format === 'csv')
    save(
      new Blob([csv(data)], { type: 'text/csv;charset=utf-8' }),
      'csv',
      slug,
    );
  if (format === 'html') {
    const name = escapeHtml(data.graphic.title);
    const css =
      'body{max-width:70rem;margin:1.5rem auto;padding:0 1rem;font:1rem/1.5 system-ui;color:#153746}figure{margin:0}img{max-width:100%;height:auto}figcaption{margin-top:1rem}a{color:#155a68}';
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(css),
    );
    const cssHash = btoa(String.fromCharCode(...new Uint8Array(digest)));
    const html =
      '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'sha256-' +
      cssHash +
      "'; base-uri 'none'; form-action 'none'\"><title>" +
      name +
      '</title><style>' +
      css +
      '</style></head><body>' +
      figure(data, image, false, true) +
      '</body></html>';
    save(new Blob([html], { type: 'text/html;charset=utf-8' }), 'html', slug);
  }
  if (format === 'png') {
    const bitmap = new Image();
    bitmap.src = image;
    await bitmap.decode();
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.naturalWidth;
    canvas.height = bitmap.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Conversion PNG indisponible');
    ctx.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(Error('PNG vide'))),
        'image/png',
      ),
    );
    save(png, 'png', slug);
  }
  feedback('Fichier ' + format.toUpperCase() + ' prêt.');
}
for (const btn of node('formats').querySelectorAll<HTMLButtonElement>(
  '[data-format]',
))
  btn.addEventListener(
    'click',
    () =>
      void download(btn.dataset.format!).catch(() =>
        feedback(
          'Création du fichier impossible. Réessayez ou téléchargez le SVG.',
        ),
      ),
  );
for (const panel of node('controls').querySelectorAll<HTMLDetailsElement>(
  '.studio-options',
))
  panel.open = !window.matchMedia('(max-width: 760px)').matches;
node('controls').hidden = false;
void select(choices.has(hash()) ? hash() : 'economie-inflation');
