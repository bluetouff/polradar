import { followDay } from './follow-window.mjs';

/** @param {string} value */
export function validHistoryDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
    return false;
  const stamp = Date.parse(value + 'T12:00:00Z');
  return (
    Number.isFinite(stamp) &&
    new Date(stamp).toISOString().slice(0, 10) === value
  );
}

/** @param {string | null} recordedAt */
export function historyRecordingDay(recordedAt) {
  const stamp = recordedAt === null ? NaN : Date.parse(recordedAt);
  return Number.isFinite(stamp) ? followDay(stamp) : null;
}

/**
 * @template {{ recordedAt: string | null, number: number }} Version
 * @param {Version[]} versions
 * @param {string} day
 */
export function recordedVersionAt(versions, day) {
  if (!validHistoryDate(day)) return null;
  /** @type {Version | null} */
  let result = null;
  for (const version of versions) {
    const recorded = historyRecordingDay(version.recordedAt);
    if (
      recorded &&
      recorded <= day &&
      (!result || version.number > result.number)
    )
      result = version;
  }
  return result;
}
