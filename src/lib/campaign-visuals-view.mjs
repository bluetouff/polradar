export function formatMoney(euros, approximate = false) {
  const scale = euros >= 1e9 ? 1e9 : euros >= 1e6 ? 1e6 : 1;
  const unit = scale === 1e9 ? 'Md€' : scale === 1e6 ? 'M€' : '€';
  return `${approximate ? '≈ ' : ''}${(euros / scale).toLocaleString('fr-FR', { maximumFractionDigits: 9 })} ${unit}`;
}
/** @param {{euros:number,eurosMax?:number,approximate:boolean}} entry */
export function formatBudgetAmount(entry) {
  if (entry.eurosMax === undefined)
    return formatMoney(entry.euros, entry.approximate);
  const unit = entry.euros >= 1e9 ? 1e9 : entry.euros >= 1e6 ? 1e6 : 1;
  const label = unit === 1e9 ? 'Md€' : unit === 1e6 ? 'M€' : '€';
  const number = (value) =>
    (value / unit).toLocaleString('fr-FR', { maximumFractionDigits: 9 });
  return `${entry.approximate ? '≈ ' : ''}${number(entry.euros)} à ${number(entry.eurosMax)} ${label}`;
}
/** The source's line items define the graphic scale, even if its printed total differs. */
export function budgetAllocationTotal(entry) {
  if (entry.allocationUnit === 'pourcentage') return 100;
  return entry.allocation.length
    ? entry.allocation.reduce((sum, part) => sum + part.value, 0)
    : entry.euros;
}
/**
 * Allocations have their own denominator. Annual amounts share a scale only
 * within the same budget category; a revenue projection is not a new expense.
 * @param {{entries:{period:string,kind:string,euros:number,eurosMax?:number,allocation:unknown[]}[]}[]} profiles
 * @returns {Record<string,number>}
 */
export function budgetAnnualScales(profiles) {
  const scales = Object.create(null);
  for (const profile of profiles)
    for (const entry of profile.entries) {
      if (entry.period === 'annuel' && !entry.allocation.length)
        scales[entry.kind] = Math.max(
          scales[entry.kind] ?? 0,
          entry.eurosMax ?? entry.euros,
        );
    }
  return scales;
}
export function parisToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function weekStart(date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function agendaStatusLabel(event, today) {
  if (event.status === 'tenu') return 'Rendez-vous tenu';
  if (event.status === 'annule') return 'Annulé';
  return (event.latestPossibleDate ?? event.date) < today
    ? 'Annonce passée · tenue non confirmée'
    : 'Rendez-vous annoncé';
}
export function agendaMatches(event, filters, today) {
  const end = event.latestPossibleDate ?? event.date;
  return (
    (!filters.candidate || event.candidate === filters.candidate) &&
    (!filters.city || event.city === filters.city) &&
    (!filters.week ||
      (weekStart(event.date) <= filters.week &&
        weekStart(end) >= filters.week)) &&
    (filters.period === 'tous' ||
      (filters.period === 'passes' ? end < today : end >= today))
  );
}
export function agendaWeeks(event) {
  const first = weekStart(event.date);
  const last = weekStart(event.latestPossibleDate ?? event.date);
  const weeks = [first];
  const cursor = new Date(`${first}T12:00:00Z`);
  while (weeks.at(-1) < last) {
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    weeks.push(cursor.toISOString().slice(0, 10));
  }
  return weeks;
}
const agendaFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
});
export function agendaDateLabel(date, latestPossibleDate) {
  const format = (s) => agendaFormatter.format(new Date(`${s}T12:00:00Z`));
  return latestPossibleDate
    ? `Entre le ${format(date)} et le ${format(latestPossibleDate)}`
    : format(date);
}
// The outline and every marker share this projection and the same padded viewBox.
export function projectFrance([lon, lat]) {
  return { x: 45 + (lon + 5.2) * 29.5, y: 35 + (51.3 - lat) * 43.5 };
}
export function francePath(rings) {
  return rings
    .map(
      (ring) =>
        ring
          .map((point, i) => {
            const p = projectFrance(point);
            return `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
          })
          .join(' ') + 'Z',
    )
    .join(' ');
}
/** @param {{id:string,name:string,coordinates:number[]}[]} cities */
export function clusterCities(cities) {
  /** @type {{cities:{id:string,name:string,x:number,y:number}[]}[]} */
  const groups = [];
  for (const city of cities) {
    const point = projectFrance(city.coordinates);
    const near = groups.filter((g) =>
      g.cities.some((c) => Math.hypot(c.x - point.x, c.y - point.y) < 34),
    );
    const merged = {
      cities: [
        ...near.flatMap((g) => g.cities),
        { id: city.id, name: city.name, ...point },
      ],
    };
    for (const group of near) groups.splice(groups.indexOf(group), 1);
    groups.push(merged);
  }
  return groups.map((g) => ({
    cities: g.cities,
    x: g.cities.reduce((s, c) => s + c.x, 0) / g.cities.length,
    y: g.cities.reduce((s, c) => s + c.y, 0) / g.cities.length,
  }));
}
