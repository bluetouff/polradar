import {
  chamberLabels,
  kindLabels,
  mentionLabels,
  coverage,
  coverageLabels,
  foldAct,
  findAct,
  officialParliamentURL,
  pageSize,
} from '../lib/parliament-search-types';
import type {
  ActFilters,
  ActIndex,
  ParliamentaryAct,
} from '../lib/parliament-search-types';

const form = document.querySelector<HTMLFormElement>('[data-act-form]')!;
const status = document.querySelector<HTMLElement>('[data-act-status]')!;
const list = document.querySelector<HTMLElement>('[data-act-list]')!;
const nav = document.querySelector<HTMLElement>('[data-act-nav]')!;
const pageLabel = document.querySelector<HTMLElement>('[data-act-page]')!;
const previous = document.querySelector<HTMLButtonElement>('[data-act-prev]')!;
const next = document.querySelector<HTMLButtonElement>('[data-act-next]')!;
const dates = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'UTC',
});
const count = new Intl.NumberFormat('fr-FR');
const keys = [
  'query',
  'candidat',
  'institution',
  'debut',
  'fin',
  'position',
  'nature',
  'theme',
] as const;
const control = (key: string) =>
  form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement;
const text = <T extends keyof HTMLElementTagNameMap>(
  tag: T,
  value: string,
  cl = '',
) => {
  const item = document.createElement(tag);
  item.textContent = value;
  if (cl) item.className = cl;
  return item;
};
const dossierURL = (value: string) => {
  const url = new URL(value, location.origin);
  if (
    url.origin === location.origin &&
    url.pathname.startsWith('/votes/dossiers/')
  )
    return url.href;
  throw Error('Lien invalide');
};
function card(row: ParliamentaryAct, data: ActIndex) {
  const item = text('article', '', 'parl-card'),
    meta = text('div', '', 'parl-meta'),
    day = text('time', dates.format(new Date(row.date + 'T00:00:00Z')));
  day.dateTime = row.date;
  meta.append(
    day,
    ' · ' + chamberLabels[row.institution] + ' · ' + kindLabels[row.nature],
  );
  item.append(meta, text('h2', row.intitule ?? row.titre));
  if (row.intitule) item.append(text('p', row.titre));
  if (row.intervenant) item.append(text('p', row.intervenant));
  if (row.mentions.length) {
    const mentions = text('ul', '', 'parl-positions');
    for (const [p, v, k] of row.mentions)
      mentions.append(
        text(
          'li',
          data.candidats[p] +
            ' · ' +
            (k === 'note' ? 'Mise au point ou intention · ' : '') +
            (mentionLabels[v] ?? v),
        ),
      );
    item.append(mentions);
  } else if (row.nature === 'vote')
    item.append(
      text(
        'p',
        'Aucune mention nominative pour les candidats suivis dans ce relevé.',
      ),
    );
  const source = text('a', 'Document officiel ↗', 'parl-source');
  source.href = officialParliamentURL(row.source);
  source.rel = 'noreferrer';
  item.append(source);
  if (row.dossier) {
    const a = text('a', 'Dossier et scrutin', 'parl-source');
    a.href = dossierURL(row.dossier);
    item.append(a);
  }
  if (row.documents?.length) {
    const documents = text('details', '', 'parl-documents');
    documents.append(text('summary', 'Textes et procès-verbaux'));
    const links = text('ul', '');
    for (const doc of row.documents) {
      const link = text('a', doc.title);
      link.href = officialParliamentURL(doc.url);
      link.rel = 'noreferrer';
      const li = text('li', '');
      li.append(link);
      links.append(li);
    }
    documents.append(links);
    item.append(documents);
  }
  return item;
}
let request: Promise<ActIndex> | undefined;
let seq = 0;
const current = new URLSearchParams(location.search);
function restore() {
  const q = new URLSearchParams(location.search);
  for (const k of keys) control(k).value = q.get(k) ?? '';
}
function href(q: URLSearchParams) {
  return location.pathname + (q.size ? '?' + q : '');
}
async function show(q: URLSearchParams, write: boolean) {
  const s = ++seq;
  const filters = Object.fromEntries(
    keys.filter((k) => q.get(k)).map((k) => [k, q.get(k)!]),
  ) as ActFilters;
  if (filters.debut && filters.fin && filters.debut > filters.fin) {
    status.textContent = 'La date de fin précède la date de début.';
    return;
  }
  if (write) history.pushState(null, '', href(q));
  status.textContent = 'Lecture de l’index parlementaire…';
  try {
    request ??= fetch('/api/parlement/recherche.json', {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Index indisponible');
        const data = (await res.json()) as ActIndex;
        if (
          data.version !== 1 ||
          !/^[a-f0-9]{64}$/.test(data.empreinte) ||
          !Array.isArray(data.actes)
        )
          throw new Error('Édition invalide');
        return data;
      })
      .catch((e) => {
        request = undefined;
        throw e;
      });
    const data = await request;
    if (s !== seq) return;
    const terms = foldAct(filters.query || '')
      .split(' ')
      .filter(Boolean);
    const hits = data.actes.filter((row) => findAct(row, filters, terms));
    const pages = Math.max(1, Math.ceil(hits.length / pageSize));
    const changed = q.has('edition') && q.get('edition') !== data.empreinte;
    const asked = Number(q.get('page') || 1);
    const page =
      changed || !Number.isSafeInteger(asked)
        ? 1
        : Math.min(pages, Math.max(1, asked));
    if (changed || page !== asked) {
      q.set('edition', data.empreinte);
      q.set('page', String(page));
      history.replaceState(null, '', href(q));
    }
    list.replaceChildren(
      ...hits
        .slice((page - 1) * pageSize, page * pageSize)
        .map((row) => card(row, data)),
    );
    status.textContent =
      (changed ? 'L’index a été actualisé. ' : '') +
      (hits.length
        ? count.format(hits.length) +
          ' résultat' +
          (hits.length > 1 ? 's' : '') +
          ' · page ' +
          page +
          ' sur ' +
          pages
        : 'Aucun résultat. ' + coverageLabels[coverage(data, filters)]);
    nav.hidden = pages <= 1;
    previous.disabled = page === 1;
    next.disabled = page === pages;
    pageLabel.textContent = page + ' / ' + pages;
    const move = (step: number) => {
      q.set('page', String(page + step));
      q.set('edition', data.empreinte);
      void show(q, true);
      status.scrollIntoView({ block: 'start' });
    };
    previous.onclick = () => move(-1);
    next.onclick = () => move(1);
  } catch {
    if (s === seq) {
      nav.hidden = true;
      status.textContent =
        'Recherche indisponible. Les registres par institution restent consultables ci-dessous.';
    }
  }
}
form.hidden = false;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = new URLSearchParams();
  for (const k of keys) {
    const v = control(k).value.trim();
    if (v) q.set(k, v);
  }
  void show(q, true);
});
addEventListener('popstate', () => {
  restore();
  void show(new URLSearchParams(location.search), false);
});
restore();
if (current.size) void show(current, false);
else {
  // Start with the HTML delivered by the server. Fetch the combined index only on use.
  nav.hidden = false;
  previous.disabled = true;
  pageLabel.textContent = 'Page 1';
  next.onclick = () => {
    const q = new URLSearchParams({ page: '2' });
    void show(q, true);
  };
}
