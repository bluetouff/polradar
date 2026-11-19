/** Shared, dependency-free rules for charts, history and local search. */
export function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/\s+/g, ' ')
    .trim();
}
export function pollSignature(poll) {
  return JSON.stringify([
    poll.institute,
    poll.round,
    poll.population,
    poll.method,
    poll.questionKey,
    poll.results.map((result) => result.id).sort(),
  ]);
}
/** @param {import('./data').Poll[]} polls @returns {import('./data').Poll[][]} */
export function pollSeries(polls) {
  const groups = new Map();
  for (const poll of polls) {
    const key = pollSignature(poll);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(poll);
  }
  return [...groups.values()].map((rows) =>
    rows.sort((a, b) => a.fieldworkEnd.localeCompare(b.fieldworkEnd)),
  );
}
/** @template T @param {T[]} entries @returns {T[]} */
export function filterEntries(entries, filters) {
  const words = normalize(filters.q || '')
    .split(' ')
    .filter(Boolean);
  return entries.filter(
    (entry) =>
      words.every((word) =>
        normalize(`${entry.title} ${entry.text}`).includes(word),
      ) &&
      (!filters.candidate ||
        entry.candidate === filters.candidate ||
        entry.candidates?.includes(filters.candidate)) &&
      (!filters.theme ||
        entry.theme === filters.theme ||
        entry.themes?.includes(filters.theme)) &&
      (!filters.type || entry.type === filters.type) &&
      (!filters.year || entry.year === filters.year) &&
      (filters.archives === '1' || entry.scope !== 'archive'),
  );
}
export function csvValue(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function exportCsv(rows) {
  return (
    '\uFEFF' +
    [
      ['Titre', 'Type', 'Candidat', 'Thème', 'Année', 'URL'],
      ...rows.map((row) => [
        row.title,
        row.type,
        row.candidate || '',
        row.theme || '',
        row.year || '',
        new URL(row.url, 'https://polradar.fr').href,
      ]),
    ]
      .map((row) => row.map(csvValue).join(';'))
      .join('\r\n')
  );
}
export function snapshotChanges(before, after) {
  const keys = [
    'title',
    'description',
    'beneficiaries',
    'timing',
    'financing',
    'metrics',
    'amounts',
    'sourceRefs',
    'scope',
    'edition',
    'checked',
  ];
  return keys
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }));
}
export function lineDiff(before, after) {
  const a = String(before || '').split('\n'),
    b = String(after || '').split('\n');
  // Bound quadratic work while preserving the full text of large revisions.
  if (a.length * b.length > 250000)
    return [
      ...a.map((text) => ({ kind: 'removed', text })),
      ...b.map((text) => ({ kind: 'added', text })),
    ];
  const dp = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const result = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j])
      (result.push({ kind: 'equal', text: a[i++] }), j++);
    else if (j < b.length && (i === a.length || dp[i][j + 1] >= dp[i + 1][j]))
      result.push({ kind: 'added', text: b[j++] });
    else result.push({ kind: 'removed', text: a[i++] });
  }
  return result;
}
export function safePreferences(raw, candidates, themes) {
  try {
    const value = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return { candidates: [], themes: [], lastVisit: null };
    const ids = (items, allowed) => [
      ...new Set(
        Array.isArray(items)
          ? items.filter((id) => typeof id === 'string' && allowed.includes(id))
          : [],
      ),
    ];
    return {
      candidates: ids(value.candidates, candidates),
      themes: ids(value.themes, themes),
      lastVisit:
        typeof value.lastVisit === 'string' &&
        Number.isFinite(Date.parse(value.lastVisit))
          ? value.lastVisit
          : null,
    };
  } catch {
    return { candidates: [], themes: [], lastVisit: null };
  }
}
/**
 * @param {import('./data').Measure[]} measures
 * @param {import('./data').Candidate[]} candidates
 * @returns {Array<{key:string,label:string,unit:string,values:Array<{candidate:string,name:string,value:number,measureId:string}>}>}
 */
export function metricGroups(measures, candidates) {
  const groups = new Map();
  for (const measure of measures) {
    if (measure.scope === 'archive') continue;
    for (const metric of measure.metrics) {
      const key = JSON.stringify([metric.key, metric.unit]);
      if (!groups.has(key))
        groups.set(key, {
          key: metric.key,
          label: metric.label,
          unit: metric.unit,
          values: [],
        });
      const group = groups.get(key);
      group.values.push({
        candidate: measure.candidate,
        name:
          measure.partyAuthor ||
          candidates.find((c) => c.id === measure.candidate)?.name ||
          measure.candidate,
        value: metric.value,
        measureId: measure.id,
      });
    }
  }
  return [...groups.values()].filter((group) => {
    if (
      group.values.some((row) => !Number.isFinite(row.value) || row.value < 0)
    )
      return false;
    const seen = new Map();
    for (const row of group.values) {
      const key = JSON.stringify([row.candidate, row.name]);
      if (seen.has(key) && seen.get(key) !== row.value) return false;
      seen.set(key, row.value);
    }
    group.values = group.values.filter(
      (row, index, rows) =>
        rows.findIndex(
          (r) => r.candidate === row.candidate && r.name === row.name,
        ) === index,
    );
    return group.values.length >= 2;
  });
}
export const pollIdentities = [
  'lepen',
  'melenchon',
  'philippe',
  'glucksmann',
  'attal',
  'retailleau',
  'roussel',
  'tondelier',
  'zemmour',
  'villepin',
  'dupont-aignan',
  'arthaud',
];
export function pollColor(id) {
  const index = pollIdentities.indexOf(id);
  return index < 0 ? 11 : index;
}
/** @param {import('./data').Poll[]} rows @param {string[]} activeIds @param {number} width */
export function chartGeometry(rows, activeIds, width = 760) {
  const left = width < 480 ? 36 : 52,
    right = width - 24;
  if (!rows.length)
    return { width, left, right, max: 100, lines: [], ticks: [], dates: [] };
  if (rows.some((row) => pollSignature(row) !== pollSignature(rows[0])))
    throw Error('Scénarios incompatibles');
  const values = rows.flatMap((row) =>
    row.results
      .filter((result) => activeIds.includes(result.id))
      .map((result) => result.percentage),
  );
  const max = Math.max(10, Math.ceil(Math.max(0, ...values) / 10) * 10);
  const start = Date.parse(rows[0].fieldworkEnd + 'T12:00:00Z'),
    end = Date.parse(rows.at(-1).fieldworkEnd + 'T12:00:00Z');
  const x = (row) =>
    end === start
      ? (left + right) / 2
      : left +
        ((Date.parse(row.fieldworkEnd + 'T12:00:00Z') - start) /
          (end - start)) *
          (right - left);
  const y = (value) => 258 - (value / max) * 210;
  const lines = rows[0].results
    .filter((result) => activeIds.includes(result.id))
    .map((result) => {
      const points = rows.map((row, index) => ({
        x: x(row),
        y: y(row.results.find((item) => item.id === result.id).percentage),
        value: row.results.find((item) => item.id === result.id).percentage,
        date: row.fieldworkEnd,
        index,
      }));
      return {
        id: result.id,
        name: result.name,
        color: pollColor(result.id),
        points,
        path: points
          .map(
            (point, index) =>
              `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
          )
          .join(' '),
      };
    });
  const tickCount = 4;
  return {
    width,
    left,
    right,
    max,
    lines,
    ticks: Array.from({ length: tickCount + 1 }, (_, index) => ({
      value: (index * max) / tickCount,
      y: y((index * max) / tickCount),
    })),
    dates: [
      ...new Set(
        width < 580
          ? [0, rows.length - 1]
          : [0, Math.floor((rows.length - 1) / 2), rows.length - 1],
      ),
    ].map((index) => ({
      index,
      date: rows[index].fieldworkEnd,
      x: x(rows[index]),
    })),
  };
}
