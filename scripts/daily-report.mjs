import { readFile, writeFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { dailyHistorySchema } from '../src/lib/daily-updates.mjs';

const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
async function optional(path) {
  try {
    return await json(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
const byId = (rows, key = 'id') => new Map(rows.map((row) => [row[key], row]));
const newest = (values) => values.filter(Boolean).sort().at(-1) ?? null;
const labels = { polymarket: 'Polymarket', kalshi: 'Kalshi' };
function without(row, fields) {
  return Object.fromEntries(
    Object.entries(row).filter(([k]) => !fields.includes(k)),
  );
}
function updatedIds(before, after, key = 'id') {
  const a = byId(before, key),
    b = byId(after, key);
  return [...new Set([...a.keys(), ...b.keys()])]
    .sort()
    .filter((k) => !isDeepStrictEqual(a.get(k), b.get(k)));
}

export function makeDailyReport({
  before,
  after,
  polls,
  markets,
  economy,
  economyReview,
  airtime,
  watch,
  config,
  sources,
  run,
  attempt,
  at,
  history,
}) {
  const previous = history.find((h) => h.run !== run || h.attempt !== attempt);
  const rows = [];
  function add(
    id,
    checked,
    dataDate,
    changes,
    review,
    incidents,
    available = true,
  ) {
    const lastChange = changes.length
      ? at
      : (previous?.rows.find((r) => r.id === id)?.lastChange ?? null);
    rows.push({
      id,
      checked,
      dataDate,
      lastChange,
      changes,
      review,
      incidents,
      status: !available
        ? 'unavailable'
        : incidents.length
          ? 'partial'
          : 'verified',
    });
  }
  const sourceNames = new Map(sources.map((s) => [s.id, s.title]));
  const ids = updatedIds(before.polls, after.polls);
  const noticeIds = new Set(
    [...before.polls, ...after.polls].map((p) => p.noticeSource),
  );
  const notices = updatedIds(before.sources, after.sources).filter((id) =>
    noticeIds.has(id),
  );
  const scenarios = byId([...before.polls, ...after.polls]);
  add(
    'sondages',
    polls?.checked ?? null,
    newest(after.polls.map((p) => p.fieldworkEnd)),
    [
      ...notices.map((id) => 'Notice · ' + (sourceNames.get(id) ?? id)),
      ...ids.map((id) => {
        const p = scenarios.get(id);
        return p.institute + ' · ' + p.scenario + ' · ' + p.published;
      }),
    ],
    (polls?.review ?? []).map((n) => 'Notice ' + n.number + ' à relire'),
    polls?.status === 'available' ? [] : ['Index ou relevé indisponible'],
    polls?.status === 'available',
  );
  for (const id of Object.keys(labels)) {
    const observed = markets?.providers.find((p) => p.id === id);
    const old = before.markets.providers.find((p) => p.id === id);
    const current = after.markets.providers.find((p) => p.id === id);
    const changes = [];
    if (old?.status === 'available' && current?.status === 'unavailable')
      changes.push('Relevé désormais indisponible');
    if (observed?.status === 'available' && current?.status === 'available') {
      if (old?.status !== 'available')
        changes.push('Relevé de nouveau disponible');
      const base = old?.status === 'available' ? old.contracts : [];
      const a = byId(base),
        b = byId(current.contracts);
      for (const key of new Set([...a.keys(), ...b.keys()])) {
        const x = a.get(key),
          y = b.get(key);
        if (
          !x ||
          !y ||
          !isDeepStrictEqual(
            without(x, ['updatedAt']),
            without(y, ['updatedAt']),
          )
        )
          changes.push(
            (y?.label ?? x.label) +
              (x && y
                ? ' · contrat actualisé'
                : y
                  ? ' · nouveau contrat'
                  : ' · contrat retiré'),
          );
      }
      if (
        old &&
        !isDeepStrictEqual(
          without(old, ['observedAt', 'contracts', 'status', 'error']),
          without(current, ['observedAt', 'contracts', 'status', 'error']),
        )
      )
        changes.push('Données générales du marché');
    }
    add(
      id,
      observed?.observedAt ?? null,
      newest(
        (current?.contracts ?? []).map(
          (c) => c.updatedAt && new Date(c.updatedAt).toISOString(),
        ),
      ),
      changes,
      [],
      observed?.status === 'available'
        ? []
        : ['Relevé de la plateforme indisponible'],
      observed?.status === 'available',
    );
  }
  const seriesNames = new Map(config.map((s) => [s.id, s.title]));
  const econ = byId(before.economy.series);
  const ecoChanges = [];
  for (const series of after.economy.series) {
    const old = new Map(
      (econ.get(series.id)?.observations ?? []).map((v) => [v[0], v.slice(1)]),
    );
    const now = new Map(series.observations.map((v) => [v[0], v.slice(1)]));
    const periods = [...new Set([...old.keys(), ...now.keys()])]
      .filter((k) => !isDeepStrictEqual(old.get(k), now.get(k)))
      .sort();
    // Long historical revisions are listed in bounded groups of periods.
    for (let i = 0; i < periods.length; i += 34)
      ecoChanges.push(
        seriesNames.get(series.id) +
          ' · ' +
          periods.slice(i, i + 34).join(', '),
      );
  }
  const failed = (economyReview?.failed ?? []).map(
    (id) => 'Série indisponible · ' + (seriesNames.get(id) ?? id),
  );
  add(
    'economie',
    economyReview?.checked ?? economy?.collectedAt ?? null,
    newest(
      after.economy.series.map((s) => new Date(s.updatedAt).toISOString()),
    ),
    ecoChanges,
    [],
    economy
      ? []
      : failed.length
        ? failed
        : ['Collecte complète indisponible. Relevé précédent conservé.'],
    !!economy,
  );
  rows.at(-1).periods = after.economy.series.map((s) => {
    const last = s.observations.findLast((point) => point[1] !== null);
    return (
      seriesNames.get(s.id) + ' · ' + (last?.[0] ?? 'période indisponible')
    );
  });
  const oldMonths = byId(before.airtime.months, 'month');
  add(
    'arcom',
    airtime?.observedAt ?? airtime?.checked ?? null,
    newest(after.airtime.months.map((m) => m.month)),
    after.airtime.months
      .filter((m) => oldMonths.get(m.month)?.sha256 !== m.sha256)
      .map((m) => 'Fichier mensuel · ' + m.month),
    [],
    airtime && airtime.status !== 'unavailable'
      ? (airtime.unavailableYears ?? []).map(
          (y) => 'Index annuel inaccessible · ' + y,
        )
      : ['Relevés Arcom indisponibles'],
    !!airtime && airtime.status !== 'unavailable',
  );
  const review = [],
    incidents = [];
  for (const w of watch ?? []) {
    const name = sourceNames.get(w.sourceId) ?? w.sourceId;
    if (w.status === 'modifie') review.push(name);
    if (['bloque', 'indisponible'].includes(w.status))
      incidents.push(
        name +
          ' · ' +
          (w.status === 'bloque' ? 'accès bloqué' : 'indisponible'),
      );
  }
  if (!watch?.length) incidents.push('Rapport de veille indisponible');
  add(
    'veille',
    newest((watch ?? []).map((w) => w.checkedAt)),
    null,
    [],
    review,
    incidents,
    !!watch?.some((w) => ['accessible', 'modifie'].includes(w.status)),
  );
  return { run, attempt, at, rows };
}

async function main() {
  const run = process.env.GITHUB_RUN_ID,
    attempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  if (
    !/^[1-9]\d{0,15}$/.test(run ?? '') ||
    !Number.isSafeInteger(attempt) ||
    attempt < 1
  )
    throw new Error('Passage GitHub non identifié');
  const history = await json('src/data/daily-updates.json');
  const before = {},
    after = {};
  for (const [key, file] of Object.entries({
    polls: 'polls',
    markets: 'prediction-markets',
    economy: 'economy',
    airtime: 'airtime',
    sources: 'sources',
  })) {
    const path = 'src/data/' + file + '.json';
    after[key] = await json(path);
    before[key] = JSON.parse(
      execFileSync('git', ['show', 'HEAD:' + path], {
        maxBuffer: 4 * 1024 * 1024,
      }),
    );
  }
  const report = makeDailyReport({
    before,
    after,
    history,
    run,
    attempt,
    at: new Date().toISOString(),
    polls: await optional('artifacts/polls-review/review.json'),
    markets: await optional('artifacts/markets-review.json'),
    economy: await optional('artifacts/economy-review/economy.json'),
    economyReview: await optional('artifacts/economy-review/status.json'),
    airtime: await optional('artifacts/airtime-review/manifest.json'),
    watch: await optional('artifacts/watch-report.json'),
    config: await json('src/data/economy-series.json'),
    sources: after.sources,
  });
  const archived = dailyHistorySchema.parse(
    [
      report,
      ...history.filter((r) => r.run !== run || r.attempt !== attempt),
    ].slice(0, 32),
  );
  const path = 'src/data/daily-updates.json';
  await writeFile(path + '.tmp', JSON.stringify(archived, null, 2) + '\n');
  await rename(path + '.tmp', path);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
