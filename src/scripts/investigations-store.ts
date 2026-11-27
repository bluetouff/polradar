import { isPublicSourceUrl } from '../lib/source-url.mjs';

export const investigationsKey = 'polradar.investigations.v1';
export const maxInvestigationBytes = 512 * 1024;
export const investigationRoot = '/suivi/enquetes/';
const site = 'https://polradar.fr';
const revision = /^[a-f0-9]{40}$/;
const id = /^[a-f0-9-]{36}$/;
const sections =
  /^\/(?:candidats|mesures|questions|comparer|votes|sondages|economie|studio|numerique|dossiers|breves|debats|budget-programmes|financements|sources|historique)\//;
const maxDossiers = 12;
const maxItems = 40;
export const investigationPage = (path: string) => sections.test(path);

export interface Reference {
  url: string;
  title: string;
  revision: string | null;
}
export interface Investigation {
  id: string;
  title: string;
  notes: string;
  items: Reference[];
}

const clean = (value: string, limit: number) =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, limit);

export function reference(item: unknown): Reference {
  if (!item || typeof item !== 'object') throw Error('Référence invalide.');
  const { url, title, revision: version } = item as Record<string, unknown>;
  if (
    typeof url !== 'string' ||
    url.length > 1500 ||
    typeof title !== 'string' ||
    !clean(title, 280) ||
    (version !== null &&
      (typeof version !== 'string' || !revision.test(version)))
  )
    throw Error('Référence invalide.');
  const local =
    url.startsWith('/') &&
    !url.startsWith('//') &&
    !/[\u0000-\u0020\u007f\\]/.test(url);
  if (!local && !isPublicSourceUrl(url))
    throw Error('Adresse de source indisponible.');
  const address = new URL(url, site);
  if (address.origin === site && !sections.test(address.pathname))
    throw Error('Page hors du dossier documentaire.');
  return {
    url:
      address.origin === site
        ? address.pathname + address.search + address.hash
        : address.href,
    title: clean(title, 280),
    revision: version as string | null,
  };
}

export function parseInvestigations(raw: string): Investigation[] {
  if (new TextEncoder().encode(raw).length > maxInvestigationBytes)
    throw Error('Fichier trop volumineux.');
  const input: unknown = JSON.parse(raw);
  if (!input || typeof input !== 'object')
    throw Error('Fichier de dossier invalide.');
  const { version, dossiers } = input as Record<string, unknown>;
  if (version !== 1) throw Error('Version de dossier incompatible.');
  if (!Array.isArray(dossiers) || dossiers.length > maxDossiers)
    throw Error('Nombre de dossiers invalide.');
  const known = new Set<string>();
  return dossiers.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw Error('Dossier invalide.');
    const row = entry as Record<string, unknown>;
    if (
      typeof row.id !== 'string' ||
      !id.test(row.id) ||
      known.has(row.id) ||
      typeof row.title !== 'string' ||
      !clean(row.title, 120) ||
      typeof row.notes !== 'string' ||
      !Array.isArray(row.items) ||
      row.items.length > maxItems
    )
      throw Error('Dossier invalide.');
    known.add(row.id);
    const items = row.items.map(reference);
    if (new Set(items.map(keyFor)).size !== items.length)
      throw Error('Référence en double.');
    return {
      id: row.id,
      title: clean(row.title, 120),
      notes: clean(row.notes, 4000),
      items,
    };
  });
}

export function investigations() {
  const raw = localStorage.getItem(investigationsKey);
  return raw ? parseInvestigations(raw) : [];
}

export function createInvestigation(title: string): Investigation {
  const name = clean(title, 120);
  if (!name) throw Error('Donnez un nom au dossier.');
  return { id: crypto.randomUUID(), title: name, notes: '', items: [] };
}

export const keyFor = (item: Reference) =>
  JSON.stringify([item.url, item.revision]);

export async function updateInvestigations(
  change: (before: Investigation[]) => Investigation[],
) {
  const edit = () => {
    const after = change(investigations());
    if (after.length > maxDossiers)
      throw Error('Douze dossiers peuvent être conservés dans ce navigateur.');
    if (after.some(({ items }) => items.length > maxItems))
      throw Error('Ce dossier a atteint 40 références.');
    if (!after.length) localStorage.removeItem(investigationsKey);
    else {
      const draft = JSON.stringify({ version: 1, dossiers: after });
      parseInvestigations(draft);
      localStorage.setItem(investigationsKey, draft);
    }
    return after;
  };
  return navigator.locks
    ? navigator.locks.request(investigationsKey, edit)
    : edit();
}
