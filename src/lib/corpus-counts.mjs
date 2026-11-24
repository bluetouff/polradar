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

/** Calendar days in the corpus use ISO civil dates, regardless of the build timezone.
 * @param {Pick<import('./data').MeasureVersion, 'observedOn'|'number'>[]} versions
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
    const day = days.get(version.observedOn);
    if (day) day[version.number === 1 ? 'added' : 'revised']++;
  }
  return [...days.values()];
}
