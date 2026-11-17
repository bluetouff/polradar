export function formatMoney(euros, approximate = false) {
  return `${approximate ? '≈ ' : ''}${(euros / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Md€`;
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
export function agendaMatches(event, filters, today) {
  return (
    (!filters.candidate || event.candidate === filters.candidate) &&
    (!filters.city || event.city === filters.city) &&
    (!filters.week || weekStart(event.date) === filters.week) &&
    (filters.period === 'tous' ||
      (filters.period === 'passes' ? event.date < today : event.date >= today))
  );
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
