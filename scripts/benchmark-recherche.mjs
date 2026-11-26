import { readFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { filterEntries } from '../src/lib/features.mjs';

const root = resolve(process.argv[2] ?? 'dist');
const modes = ['', '--validation', '--confirmation', '--recette'];
const common = process.argv[3] === '--commun';
const mode = common ? 0 : modes.indexOf(process.argv[3] ?? '');
if (mode < 0) throw Error('Jeu de recherche inconnu.');
const loadQueries = (name) =>
  readFileSync(
    new URL(`../docs/refonte/requetes${name.slice(1)}.tsv`, import.meta.url),
    'utf8',
  );
const reference = modes.slice(0, mode).map(loadQueries);
const editorialQueries = () =>
  loadQueries(modes[mode])
    .trim()
    .split('\n')
    .map((line) => {
      const [family, query, expected, extra] = line.split('\t');
      if (!family || !query || !expected || extra)
        throw Error('Cas de recherche mal formé.');
      return {
        family,
        query,
        expected: expected === '-' ? [] : expected.split(' | '),
      };
    });
const measureURL = (id) => '/mesures/' + id + '/';
const queries = common
  ? JSON.parse(
      readFileSync(
        new URL('../mcp/testdata/recherche-commune.json', import.meta.url),
        'utf8',
      ),
    ).cases.map((row) => ({
      family: row.id,
      query: row.query,
      expected: row.expected.map(measureURL),
      excluded: (row.excluded ?? []).map(measureURL),
      filters: { candidate: row.candidate, theme: row.theme, type: 'mesure' },
    }))
  : editorialQueries();
if (
  (!common && !mode && queries.length !== 100) ||
  (mode &&
    queries.some(({ query }) =>
      reference.some((set) => set.includes('\t' + query + '\t')),
    )) ||
  new Set(queries.map(({ query }) => query)).size !== queries.length
)
  throw Error('Les bancs doivent contenir des requêtes distinctes.');
const index = JSON.parse(
  readFileSync(resolve(root, 'api/recherche.json'), 'utf8'),
);
const revision = JSON.parse(readFileSync(resolve(root, 'build.json'), 'utf8'));
const urls = new Set(index.map(({ url }) => url));
const missing = queries.flatMap(({ expected }) =>
  expected.filter((url) => !urls.has(url)),
);
if (missing.length)
  console.error(
    'Attentes absentes de cet index :',
    [...new Set(missing)].join(' · '),
  );

function run() {
  return queries.map(({ family, query, expected, filters, excluded }) => {
    const then = performance.now();
    const rows = filterEntries(index, { ...filters, q: query });
    const durationMs = performance.now() - then;
    const rank = rows.findIndex(({ url }) => expected.includes(url)) + 1;
    const firstFive = rows.slice(0, 5).map(({ url }) => url);
    return {
      family,
      query,
      expected,
      durationMs,
      count: rows.length,
      rank: rank || null,
      success:
        (expected.length ? rank > 0 && rank <= 5 : rows.length === 0) &&
        !excluded?.some((url) => firstFive.includes(url)),
      firstFive,
    };
  });
}
const cold = run();
const results = run();
const success = results.filter((row) => row.success).length;
const positive = results.filter((row) => row.expected.length > 0);
const first = positive.filter((row) => row.rank === 1).length;
const mrr5 =
  positive.reduce(
    (sum, row) => sum + (row.rank > 0 && row.rank <= 5 ? 1 / row.rank : 0),
    0,
  ) / positive.length;
const percentile = (rows, p) =>
  Number(
    rows
      .map(({ durationMs }) => durationMs)
      .sort((a, b) => a - b)
      [Math.ceil(rows.length * p) - 1].toFixed(2),
  );
const score = Object.fromEntries(
  [...new Set(results.map(({ family }) => family))].map((family) => {
    const items = results.filter((row) => row.family === family);
    return [
      family,
      {
        success: items.filter((row) => row.success).length,
        total: items.length,
      },
    ];
  }),
);
console.log(
  JSON.stringify(
    {
      sourceCommit: revision.sourceCommit,
      host: [process.platform, process.arch, cpus()[0]?.model, process.version],
      index: index.length,
      total: queries.length,
      success,
      ...(common
        ? { premiersRangs: first, questionsPositives: positive.length, mrr5 }
        : {}),
      score,
      absentExpectedUrls: [...new Set(missing)],
      durationMs: {
        firstQuery: Number(cold[0].durationMs.toFixed(2)),
        warmP50: percentile(results, 0.5),
        warmP95: percentile(results, 0.95),
      },
      results,
    },
    null,
    2,
  ),
);
const minimum = common
  ? queries.length
  : mode
    ? Math.ceil(0.9 * queries.length)
    : 97;
if (success < minimum || missing.length) process.exitCode = 1;
