export const maxComparisonCandidates = 6;

export function comparisonIds(raw: string | null, known?: ReadonlySet<string>) {
  const ids = (raw ?? '').slice(0, 606).split(',');
  return [...new Set(ids)]
    .filter(
      (id) =>
        id.length <= 100 &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) &&
        (!known || known.has(id)),
    )
    .slice(0, maxComparisonCandidates);
}

export function comparisonSlots(count: string | null, chosen: number) {
  const requested = count && /^[2-6]$/.test(count) ? Number(count) : 2;
  return Math.max(2, chosen, requested);
}
