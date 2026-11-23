export const communeDataPath = '/data/communes/2022/';
export const communePage = '/communes/';
export const communeCode = /^(?:[0-9]{2}|2[AB])[0-9]{3}$/;
export const communeLink = (code) => `#commune=${code}`;
export const parseCommuneLink = (hash) =>
  /^#commune=((?:[0-9]{2}|2[AB])[0-9]{3})$/.exec(hash)?.[1] ?? null;

const number = new Intl.NumberFormat('fr-FR');
const percent = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inseePercent = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const integerLabel = (value) => number.format(value);
export const percentLabel = (count, total) =>
  total > 0 ? percent.format(count / total) : 'Indisponible';
export const vacancyLabel = (vacant, total) =>
  total > 0 ? inseePercent.format(vacant / total) : 'Indisponible';
export const percentWidth = (count, total) =>
  total > 0 ? (count / total) * 100 : 0;

export function searchKey(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll('œ', 'oe')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** @param {unknown} value @returns {Array<[string,string]>} */
export function readCommuneIndex(value) {
  if (!Array.isArray(value)) throw new Error('Index des communes invalide');
  const seen = new Set();
  return value.map((item) => {
    if (
      !Array.isArray(item) ||
      item.length !== 2 ||
      typeof item[0] !== 'string' ||
      !communeCode.test(item[0]) ||
      seen.has(item[0]) ||
      typeof item[1] !== 'string' ||
      !item[1].trim() ||
      item[1].length > 150 ||
      /[\u0000-\u001f\u007f]/u.test(item[1])
    )
      throw new Error('Entrée communale invalide');
    seen.add(item[0]);
    return [item[0], item[1]];
  });
}

export function updateCommuneIndex(baseline, changes) {
  const names = new Map(readCommuneIndex(baseline));
  if (!Array.isArray(changes?.removed))
    throw Error('Édition communale invalide');
  for (const code of changes.removed) {
    if (!names.delete(code)) throw Error('Code communal à retirer inconnu');
  }
  for (const [code, name] of readCommuneIndex(changes.entries))
    names.set(code, name);
  return [...names].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** @param {unknown} row @param {number} size @returns {number[]} */
export function readBallot(row, size) {
  if (
    !Array.isArray(row) ||
    row.length !== size + 4 ||
    row.some(
      (value) =>
        !Number.isSafeInteger(value) || value < 0 || value > 100_000_000,
    )
  )
    throw new Error('Bulletin invalide');
  const [registered, voters, blank, invalid, ...votes] = row;
  if (
    voters > registered ||
    blank + invalid + votes.reduce((sum, count) => sum + count, 0) !== voters
  )
    throw new Error('Totaux du scrutin incohérents');
  return row;
}

/** @param {unknown} value @returns {[number,number,number] | null} */
function readContext(value) {
  if (value === null) return null;
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some(
      (number) =>
        !Number.isFinite(number) || number < 0 || number > 100_000_000,
    ) ||
    !Number.isSafeInteger(value[0]) ||
    value[2] > value[1]
  )
    throw new Error('Indicateurs Insee invalides');
  return [value[0], value[1], value[2]];
}

/** @param {unknown} value @param {string} code @param {number[]} sizes @returns {[string, number[], number[], [number, number, number] | null]} */
export function readCommune(value, code, sizes) {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !communeCode.test(code) ||
    value[0] !== code
  )
    throw new Error('Code Insee inattendu');
  return [
    code,
    readBallot(value[1], sizes[0]),
    readBallot(value[2], sizes[1]),
    readContext(value[3]),
  ];
}

/** @param {number[]} counts @param {string[]} names */
export function describeBallot(counts, names) {
  const [registered, voters, blank, invalid, ...votes] = counts;
  const expressed = voters - blank - invalid;
  return {
    registered,
    voters,
    blank,
    invalid,
    expressed,
    abstained: registered - voters,
    participants: percentLabel(voters, registered),
    width: percentWidth(voters, registered),
    candidates: names
      .map((name, index) => ({
        name,
        count: votes[index],
        score: percentLabel(votes[index], expressed),
        width: percentWidth(votes[index], expressed),
      }))
      .sort((left, right) => right.count - left.count),
  };
}

/** @param {Array<{ code: string, name: string, key: string }>} index @param {string} query */
export function searchCommunes(index, query) {
  if (query.length < 2) return [];
  const exact = [];
  const starts = [];
  const includes = [];
  for (const entry of index) {
    if (entry.code.toLowerCase() === query || entry.key === query)
      exact.push(entry);
    else if (
      entry.key.startsWith(query) ||
      entry.code.toLowerCase().startsWith(query)
    )
      starts.push(entry);
    else if (entry.key.includes(` ${query}`)) includes.push(entry);
  }
  return exact.concat(starts, includes).slice(0, 8);
}
