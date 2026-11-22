const paris = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const followDay = (timestamp) => paris.format(timestamp);
export function followWindow(now, hours) {
  const start = now - hours * 3600000;
  return { start, now, first: followDay(start), last: followDay(now) };
}
export function withinWindow(row, period) {
  if (!row.at) return row.day > period.first && row.day <= period.last;
  const stamp = Date.parse(row.at);
  return stamp >= period.start && stamp <= period.now;
}
export function sharedChange(hash, dates) {
  const raw = new URLSearchParams(hash.replace(/^#/, '')).get('changement');
  if (raw === null) return null;
  const parts = /^(\d{4}-\d{2}-\d{2}):([a-z0-9-]{1,220})$/.exec(raw);
  return parts && dates.includes(parts[1])
    ? { day: parts[1], id: parts[2] }
    : { day: null, id: null };
}
