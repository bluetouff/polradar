import { choiceLabel, termLabel } from '../lib/parliamentary-labels';
import type { ParliamentaryBallot } from '../lib/parliamentary-register';

interface Register {
  personnes: Record<string, { nom: string }>;
  groupes: Record<string, { nom: string }>;
  scrutins: ParliamentaryBallot[];
}
const form = document.querySelector<HTMLFormElement>('[data-parl-search]');
const status = document.querySelector<HTMLElement>('[data-parl-status]')!;
const original = document.querySelector<HTMLElement>('[data-parl-static]')!;
const filtered = document.querySelector<HTMLElement>('[data-parl-filtered]')!;
const grid = document.querySelector<HTMLElement>('[data-parl-grid]')!;
const nav = document.querySelector<HTMLElement>('[data-parl-nav]')!;
const current = document.querySelector<HTMLElement>('[data-parl-current]')!;
const prev = document.querySelector<HTMLButtonElement>('[data-parl-prev]')!;
const next = document.querySelector<HTMLButtonElement>('[data-parl-next]')!;
const initialStatus = status.textContent;
const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'UTC',
});
const countFormat = new Intl.NumberFormat('fr-FR');
const fold = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/[’']/gu, ' ')
    .trim();
const element = <T extends keyof HTMLElementTagNameMap>(
  tag: T,
  text: string,
  className?: string,
) => {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
};
function ballotCard(b: ParliamentaryBallot, register: Register) {
  const card = element('article', '', 'parl-card');
  const meta = element('div', '', 'parl-meta');
  const date = element(
    'time',
    dateFormat.format(new Date(b.date + 'T00:00:00Z')),
  );
  date.dateTime = b.date;
  meta.append(
    date,
    ` · ${termLabel(b.legislature)} législature · n° ${b.numero}`,
  );
  const result = element('p', '', 'parl-result');
  result.append(
    element('strong', `Texte ${b.decision}`),
    ` · ${b.totaux.pour} pour`,
  );
  if (b.totaux.contre !== null)
    result.append(
      ` · ${b.totaux.contre} contre · ${b.totaux.abstention} abstentions`,
    );
  const list = element('ul', '', 'parl-positions');
  list.setAttribute('aria-label', 'Positions nominatives');
  for (const p of b.positions) {
    const row = element('li', '');
    row.append(
      element('strong', register.personnes[p.candidat].nom),
      ` · ${choiceLabel(p.vote)}${p.delegation ? ' (par délégation)' : ''}`,
    );
    if (p.groupe) row.append(element('small', register.groupes[p.groupe].nom));
    for (const m of p.misesAuPoint)
      row.append(element('small', `Mise au point · ${choiceLabel(m.vote)}`));
    list.append(row);
  }
  const link = element('a', `Scrutin officiel n° ${b.numero} ↗`, 'parl-source');
  link.href = `https://www.assemblee-nationale.fr/dyn/${Number(b.legislature)}/scrutins/${Number(b.numero)}`;
  link.rel = 'noreferrer';
  card.append(meta, element('h2', b.objet), result, list, link);
  return card;
}
let request: Promise<Register> | null = null;
let sequence = 0;
let register: Register | undefined;
let results: ParliamentaryBallot[] = [];
let page = 0;
const perPage = 30;
function render(announce: boolean) {
  if (!register) return;
  const pages = Math.ceil(results.length / perPage);
  const cards = results
    .slice(page * perPage, (page + 1) * perPage)
    .map((b) => ballotCard(b, register!));
  grid.replaceChildren(...cards);
  original.hidden = true;
  filtered.hidden = false;
  nav.hidden = pages < 2;
  prev.disabled = page === 0;
  next.disabled = page + 1 >= pages;
  current.textContent = `Page ${page + 1} sur ${pages}`;
  status.textContent =
    results.length === 0
      ? 'Aucun scrutin pour cette recherche.'
      : `${countFormat.format(results.length)} scrutin${results.length > 1 ? 's' : ''} · page ${page + 1} sur ${pages}`;
  if (announce) status.scrollIntoView({ block: 'start' });
}
function reset() {
  sequence++;
  original.hidden = false;
  filtered.hidden = true;
  grid.replaceChildren();
  status.textContent = initialStatus;
}
if (form) {
  form.hidden = false;
  form.addEventListener('reset', reset);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = new FormData(form);
    const terms = fold(String(values.get('objet') || ''))
      .split(/\s+/u)
      .filter(Boolean);
    const candidate = String(values.get('depute') || '');
    const term = String(values.get('legislature') || '');
    if (!terms.length && !candidate && !term) {
      reset();
      return;
    }
    const token = ++sequence;
    status.textContent = 'Recherche dans le registre…';
    try {
      request ??= fetch('/api/parlement/assemblee.json', {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
        .then((r) => {
          if (!r.ok) throw new Error('Registre indisponible');
          return r.json();
        })
        .catch((e) => {
          request = null;
          throw e;
        });
      const data = await request;
      if (token !== sequence || !data) return;
      register = data;
      results = data.scrutins.filter((b) => {
        if (term && String(b.legislature) !== term) return false;
        if (candidate && !b.positions.some((p) => p.candidat === candidate))
          return false;
        const title = fold(b.objet);
        return terms.every((t) =>
          /^\d+$/u.test(t)
            ? String(b.numero) === t || title.split(/\D+/u).includes(t)
            : title.includes(t),
        );
      });
      page = 0;
      render(false);
    } catch {
      if (token === sequence) {
        original.hidden = false;
        filtered.hidden = true;
        status.textContent =
          'Recherche indisponible. Les scrutins restent consultables ci-dessous.';
      }
    }
  });
  prev.addEventListener('click', () => {
    if (page > 0) {
      page--;
      render(true);
    }
  });
  next.addEventListener('click', () => {
    if ((page + 1) * perPage < results.length) {
      page++;
      render(true);
    }
  });
}
