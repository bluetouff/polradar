export const savedViewsKey = 'polradar.follow.saved.v1';
const limit = 40;
const maximumStoredLength = 128 * 1024;

type Kind = 'search' | 'compare';
export interface SavedView {
  kind: Kind;
  parameters: string;
  title: string;
}

function slug(value: string) {
  return value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function plainText(value: string, maximum: number) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maximum);
}

export function savedParameters(kind: Kind, input: URLSearchParams) {
  const parameters = new URLSearchParams();
  if (kind === 'search') {
    const query = plainText(input.get('q') ?? '', 200);
    if (query) parameters.set('q', query);
    for (const name of ['candidate', 'theme', 'type']) {
      const value = input.get(name) ?? '';
      if (slug(value)) parameters.set(name, value);
    }
    const year = input.get('year') ?? '';
    if (/^\d{4}$/.test(year)) parameters.set('year', year);
  } else {
    const candidates = (input.get('c') ?? '').split(',');
    if (
      candidates.length < 2 ||
      candidates.length > 3 ||
      new Set(candidates).size !== candidates.length ||
      !candidates.every(slug)
    )
      return '';
    for (const name of ['theme', 'question']) {
      const value = input.get(name) ?? '';
      if (slug(value)) parameters.set(name, value);
    }
    parameters.set('c', candidates.join(','));
    if (candidates.length === 2 && input.get('count') === '3')
      parameters.set('count', '3');
  }
  if (input.get('archives') === '1') parameters.set('archives', '1');
  return parameters.toString();
}

function identity(view: SavedView) {
  return view.kind + ' ' + view.parameters;
}

export function readSavedViews(): SavedView[] {
  const raw = localStorage.getItem(savedViewsKey) ?? '';
  if (!raw || raw.length > maximumStoredLength) return [];
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(stored)) return [];
  const views = new Map<string, SavedView>();
  for (const item of stored.slice(0, limit)) {
    if (
      (item?.kind !== 'search' && item?.kind !== 'compare') ||
      typeof item.parameters !== 'string' ||
      typeof item.title !== 'string'
    )
      continue;
    const parameters = savedParameters(
      item.kind,
      new URLSearchParams(item.parameters),
    );
    const title = plainText(item.title, 400);
    if (!parameters || !title) continue;
    const view: SavedView = { kind: item.kind, parameters, title };
    views.set(identity(view), view);
  }
  return [...views.values()];
}

async function updateSavedViews(change: () => void) {
  if (navigator.locks) await navigator.locks.request(savedViewsKey, change);
  else change();
}

export async function saveView(
  kind: Kind,
  input: URLSearchParams,
  title: string,
) {
  const parameters = savedParameters(kind, input);
  const view: SavedView = { kind, parameters, title: plainText(title, 400) };
  if (!parameters || !view.title)
    return 'Sélectionnez des critères à enregistrer.';
  let message =
    kind === 'search'
      ? 'Recherche enregistrée dans Mon suivi.'
      : 'Comparaison enregistrée dans Mon suivi.';
  try {
    await updateSavedViews(() => {
      const previous = readSavedViews();
      if (previous.some((item) => identity(item) === identity(view))) {
        message = 'Cette sélection est déjà dans Mon suivi.';
      } else if (previous.length >= limit) {
        message =
          'Mon suivi est plein. Retirez une sélection pour en ajouter une autre.';
      } else {
        localStorage.setItem(
          savedViewsKey,
          JSON.stringify([view, ...previous]),
        );
      }
    });
    return message;
  } catch {
    return 'Le stockage local est indisponible. La sélection n’a pas été enregistrée.';
  }
}

export function savedViewLink(view: SavedView) {
  const start =
    view.kind === 'search' ? '/recherche/#' : '/comparer/#comparaison?';
  return start + view.parameters;
}

export async function removeSavedView(view: SavedView) {
  await updateSavedViews(() => {
    const remaining = readSavedViews().filter(
      (item) => identity(item) !== identity(view),
    );
    if (remaining.length)
      localStorage.setItem(savedViewsKey, JSON.stringify(remaining));
    else localStorage.removeItem(savedViewsKey);
  });
}

export async function clearSavedViews() {
  await updateSavedViews(() => localStorage.removeItem(savedViewsKey));
}
