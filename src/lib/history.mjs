import { isDeepStrictEqual } from 'node:util';

/** Existing snapshots are append-only; formatting and object key order may change. */
export function immutableHistoryErrors(previous, current) {
  const errors = [];
  const byId = new Map(current.map((version) => [version.id, version]));
  for (const version of previous) {
    const next = byId.get(version.id);
    if (!next) errors.push(`${version.id}: version supprimée`);
    else if (!isDeepStrictEqual(version, next))
      errors.push(`${version.id}: ancienne version réécrite`);
  }
  return errors;
}
