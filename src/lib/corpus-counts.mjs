import { civilDateInParis } from './schema.mjs';

const emptyCounts = () => ({
  campagne: 0,
  parti: 0,
  orientation: 0,
  archive: 0,
});

/** Count the current record of each measure. Revisions and parent dossiers are different units.
 * @param {Pick<import('./data').Corpus, 'measures'|'themes'|'candidates'>} corpus
 */
export function corpusCounts({ measures, themes, candidates }) {
  const counts = emptyCounts();
  const byTheme = new Map(
    themes.map((t) => [t.id, { ...t, counts: emptyCounts() }]),
  );
  const byCandidate = new Map(
    candidates.map((c) => [c.id, { ...c, counts: emptyCounts() }]),
  );
  for (const row of measures) {
    counts[row.scope]++;
    byTheme.get(row.theme).counts[row.scope]++;
    byCandidate.get(row.candidate).counts[row.scope]++;
  }
  const current = counts.campagne + counts.parti + counts.orientation;
  return {
    counts,
    current,
    proposals: counts.campagne + counts.parti,
    total: current + counts.archive,
    themes: [...byTheme.values()],
    candidates: [...byCandidate.values()].sort((a, b) =>
      a.id.localeCompare(b.id, 'fr'),
    ),
  };
}

/** Identify identical current wording across documents. A group is a reading task.
 * @param {import('./data').Measure[]} measures
 */
export function identicalProposals(measures) {
  const text = (value) =>
    value?.normalize('NFC').trim().replace(/\s+/gu, ' ') ?? null;
  const groups = new Map();
  for (const row of measures) {
    if (row.scope !== 'campagne' && row.scope !== 'parti') continue;
    // A collective author without an explicit name still requires editorial review.
    if (row.scope === 'parti' && !row.partyAuthor) continue;
    const key = JSON.stringify([
      row.candidate,
      row.scope,
      row.partyAuthor ?? null,
      text(row.title),
      text(row.description),
      text(row.beneficiaries),
      text(row.timing),
      text(row.financing),
      row.metrics.map(({ key, label, value, unit }) => [
        key,
        label,
        value,
        unit,
      ]),
      row.amounts.map(({ label, value, unit, period, basis }) => [
        label,
        value,
        unit,
        period,
        basis,
      ]),
    ]);
    const group = groups.get(key) ?? [];
    group.push(row.id);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.sort());
}

/** The editorial record can predate registration in Polradar.
 * @template {Pick<import('./data').MeasureVersion, 'recordedAt'>} Version
 * @param {Version[]} versions
 * @returns {Version | null}
 */
export function latestRecordedVersion(versions) {
  let latest = null;
  let latestTime = -Infinity;
  for (const version of versions) {
    if (!version.recordedAt) continue;
    const time = Date.parse(version.recordedAt);
    if (time <= latestTime) continue;
    latestTime = time;
    latest = version;
  }
  return latest;
}

/** Count versions by their registration day in Paris.
 * @param {Pick<import('./data').MeasureVersion, 'recordedAt'|'number'>[]} versions
 * @param {string} through
 */
export function corpusActivity(versions, through) {
  const end = Date.parse(through + 'T00:00:00Z');
  const days = new Map();
  for (let back = 13; back >= 0; back--) {
    const date = new Date(end - back * 86400000).toISOString().slice(0, 10);
    days.set(date, { date, added: 0, revised: 0 });
  }
  for (const version of versions) {
    if (!version.recordedAt) continue;
    const day = days.get(civilDateInParis(new Date(version.recordedAt)));
    if (day) day[version.number === 1 ? 'added' : 'revised']++;
  }
  return [...days.values()];
}
