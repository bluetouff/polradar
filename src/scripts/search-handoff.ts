const key = 'polradar.search.handoff';

export function handoffSearch(query: string) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ query, at: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function takeSearchHandoff() {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return '';
    sessionStorage.removeItem(key);
    if (raw.length > 1600) return '';
    const value = JSON.parse(raw);
    if (typeof value?.query !== 'string' || !Number.isSafeInteger(value?.at))
      return '';
    const age = Date.now() - value.at;
    return age >= 0 && age <= 60_000 ? value.query.trim().slice(0, 200) : '';
  } catch {
    return '';
  }
}
