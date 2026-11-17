export function formatDuration(value) {
  if (value === null) return 'Non publié';
  const h = Math.floor(value / 3600),
    m = Math.floor((value % 3600) / 60),
    s = value % 60;
  return [
    h ? `${h} h` : '',
    m ? `${m} min` : '',
    s || (!h && !m) ? `${s} s` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
/**
 * @typedef {{candidate:string, seconds:number|null, publishedCells:number}} AirtimeObservation
 * @typedef {{name:string, kind:string, totalSeconds:number|null, publishedCells:number, observations:AirtimeObservation[]}} AirtimeService
 * @param {{months:{month:string,services:AirtimeService[]}[]}} snapshot
 * @param {string} month
 * @param {string} kind
 * @param {string} candidate
 */
export function airtimeView(snapshot, month, kind, candidate = '') {
  const period = snapshot.months.find((m) => m.month === month);
  if (!period) throw new Error('Mois inconnu');
  const rows = period.services.filter((s) => !kind || s.kind === kind);
  const totals = [
    ...new Set(rows.flatMap((s) => s.observations.map((o) => o.candidate))),
  ].map((id) => ({
    id,
    seconds: rows.reduce(
      (sum, s) =>
        sum + (s.observations.find((o) => o.candidate === id)?.seconds ?? 0),
      0,
    ),
  }));
  const leaders = candidate
    ? [candidate]
    : totals
        .sort((a, b) => b.seconds - a.seconds || a.id.localeCompare(b.id))
        .filter((o) => o.seconds > 0)
        .slice(0, 5)
        .map((o) => o.id);
  return {
    leaders,
    rows: rows.map((s) => {
      let x = 0;
      const segments = leaders.map((id, index) => {
        const seconds =
          s.observations.find((o) => o.candidate === id)?.seconds ?? null;
        const width = s.totalSeconds
          ? ((seconds ?? 0) / s.totalSeconds) * 100
          : 0;
        const part = { id, seconds, width, x, color: index };
        x += width;
        return part;
      });
      const known = segments.reduce((n, p) => n + (p.seconds ?? 0), 0);
      return {
        ...s,
        segments,
        others: s.totalSeconds === null ? null : s.totalSeconds - known,
        othersX: x,
        othersWidth: s.totalSeconds ? Math.max(0, 100 - x) : 0,
      };
    }),
  };
}
