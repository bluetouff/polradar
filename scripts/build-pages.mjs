// Every build still produces a complete, validated static site. Only detail pages
// whose inputs can be verified against the previous successful build are reused.
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  readdirSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import path from 'node:path';

const cache = '.cache/polradar-pages',
  previousIndex = path.join(cache, 'index.json');
const validId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hash = (data) => createHash('sha256').update(data).digest('hex');
const json = (name) => JSON.parse(readFileSync(name, 'utf8'));
const data = (name) => json('src/data/' + name + '.json');
function regular(name, max) {
  const st = lstatSync(name);
  if (!st.isFile() || st.size > max) throw Error('Entrée du cache invalide');
  return readFileSync(name);
}
function directory(name) {
  mkdirSync(name, { recursive: true });
  if (!lstatSync(name).isDirectory()) throw Error('Répertoire attendu');
}
function atomic(name, bytes) {
  const tmp = path.join(path.dirname(name), '.pending-' + randomUUID());
  try {
    writeFileSync(tmp, bytes, { flag: 'wx' });
    renameSync(tmp, name);
  } finally {
    rmSync(tmp, { force: true });
  }
}
const sortEntries = (object) =>
  Object.fromEntries(
    Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
const fastInputs = new Set(
  [
    'measures',
    'sources',
    'versions',
    'meta',
    'campaign-agenda',
    'events',
    'polls',
    'economy',
    'economy-series',
    'airtime',
    'daily-updates',
    'editorial-reviews',
    'watch',
    'prediction-markets',
    'poll-catalogue',
  ].map((n) => 'src/data/' + n + '.json'),
);
function sharedSignature() {
  const h = createHash('sha256');
  h.update(
    JSON.stringify([
      process.platform,
      process.arch,
      process.versions.node,
      process.versions.icu,
    ]),
  );
  const tracked = execFileSync('git', [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
    '--',
    'src',
    'public',
    'scripts',
    'package.json',
    'package-lock.json',
    'astro.config.mjs',
    '.node-version',
  ])
    .toString()
    .split('\0')
    .filter(Boolean)
    .sort();
  for (const file of tracked) {
    if (
      fastInputs.has(file) ||
      file.startsWith('public/og/') ||
      file.startsWith('src/content/articles/') ||
      file.startsWith('src/content/breves/')
    )
      continue;
    h.update(file + '\0' + hash(readFileSync(file)) + '\0');
  }
  const { edition, corpusUpdated, ...metadata } = data('meta');
  h.update(JSON.stringify(metadata));
  return h.digest('hex');
}
function catalogue() {
  const measures = data('measures'),
    versions = data('versions'),
    sources = data('sources');
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const history = new Map();
  for (const v of versions) {
    if (!history.has(v.measureId)) history.set(v.measureId, []);
    history.get(v.measureId).push(v);
  }
  const signatures = Object.create(null);
  for (const m of measures) {
    if (
      m.id.length > 100 ||
      !validId.test(m.id) ||
      Object.hasOwn(signatures, m.id)
    )
      throw Error('Identifiant de fiche invalide');
    signatures[m.id] = hash(
      JSON.stringify([
        m,
        history.get(m.id),
        m.sourceRefs.map((ref) => sourceById.get(ref.sourceId)),
        (history.get(m.id) ?? []).flatMap((v) =>
          v.snapshot.sourceRefs.map((ref) => sourceById.get(ref.sourceId)),
        ),
      ]),
    );
  }
  // Any rewrite to an existing source can also affect an indirect vote reference.
  const refs = Object.fromEntries(
    sources.map((s) => [s.id, hash(JSON.stringify(s))]),
  );
  return { signatures, refs };
}
function stamps(html) {
  const items = [];
  for (const name of ['edition', 'corpus']) {
    const exp = new RegExp(
      '<time data-polradar-date="' + name + '"[^>]*>[\\s\\S]*?</time>',
      'g',
    );
    const m = [...html.matchAll(exp)];
    if (m.length !== 1) throw Error('Gabarit des dates inconnu');
    items.push(m[0][0]);
  }
  return items;
}
function assets() {
  const d = 'dist/_astro';
  function walk(relative) {
    return readdirSync(path.join(d, relative), { withFileTypes: true }).flatMap(
      (e) => {
        const name = path.join(relative, e.name);
        if (e.isDirectory()) return walk(name);
        if (!e.isFile()) throw Error('Ressource compilée non ordinaire');
        return [[name, hash(readFileSync(path.join(d, name)))]];
      },
    );
  }
  return hash(JSON.stringify(sortEntries(Object.fromEntries(walk('')))));
}
function build(subset) {
  const env = { ...process.env };
  delete env.POLRADAR_FILTER_MEASURES;
  if (subset) {
    atomic(path.join(cache, 'render.json'), JSON.stringify(subset));
    env.POLRADAR_FILTER_MEASURES = '1';
  }
  execFileSync(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build'],
    { env, stdio: 'inherit' },
  );
}
const targetFor = (id) => path.join('dist', 'mesures', id, 'index.html');
const blobFor = (digest) => path.join(cache, 'html', digest + '.html');
directory('.cache');
directory(cache);
directory(path.join(cache, 'html'));
const { signatures, refs } = catalogue();
const common = sharedSignature();
let previous;
try {
  previous = JSON.parse(regular(previousIndex, 4_000_000));
} catch {
  previous = null;
}
const plan = new Map();
const ids = Object.keys(signatures);
if (
  !process.argv.includes('--full') &&
  previous?.schema === 1 &&
  previous.shared === common &&
  previous.refs &&
  previous.pages &&
  Object.entries(previous.refs).every(([id, digest]) => refs[id] === digest)
) {
  for (const id of ids) {
    const entry = Object.hasOwn(previous.pages, id) && previous.pages[id];
    if (entry?.input !== signatures[id] || !/^[0-9a-f]{64}$/.test(entry.blob))
      continue;
    try {
      const bytes = regular(blobFor(entry.blob), 2_000_000);
      if (hash(bytes) === entry.blob) plan.set(id, entry.blob);
    } catch {
      /* A missing entry is rendered by Astro. */
    }
  }
}
const witness = ids.find((id) => !plan.has(id)) ?? ids[0];
if (witness) plan.delete(witness);
let restored = 0;
build(plan.size ? ids.filter((id) => !plan.has(id)) : null);
if (plan.size) {
  try {
    if (previous.assets !== assets())
      throw Error('Ressources compilées modifiées');
    const dates = stamps(readFileSync(targetFor(witness), 'utf8'));
    for (const [id, digest] of plan) {
      const bytes = regular(blobFor(digest), 2_000_000);
      if (hash(bytes) !== digest) throw Error('Empreinte du cache invalide');
      let html = bytes.toString('utf8');
      const old = stamps(html);
      html = html
        .replace(old[0], () => dates[0])
        .replace(old[1], () => dates[1]);
      directory(path.dirname(targetFor(id)));
      atomic(targetFor(id), html);
      restored++;
    }
  } catch {
    console.log(
      'Reconstruction complète après modification du gabarit, des ressources ou du cache.',
    );
    restored = 0;
    build(null);
  }
}
if (
  readdirSync('dist/mesures', { withFileTypes: true }).filter(
    (e) => e.isDirectory() && e.name !== 'page',
  ).length !== ids.length ||
  ids.some((id) => !lstatSync(targetFor(id)).isFile())
)
  throw Error('Inventaire des fiches incomplet');
execFileSync(process.execPath, ['scripts/postbuild.mjs'], { stdio: 'inherit' });
const pages = Object.create(null);
for (const id of ids) {
  const bytes = readFileSync(targetFor(id)),
    blob = hash(bytes);
  pages[id] = { input: signatures[id], blob };
  // Rewriting a verified file is unnecessary. New or repaired entries are atomic.
  if (plan.get(id) !== blob) atomic(blobFor(blob), bytes);
}
atomic(
  previousIndex,
  JSON.stringify({ schema: 1, shared: common, assets: assets(), refs, pages }),
);
const current = new Set(Object.values(pages).map((p) => p.blob + '.html'));
for (const file of readdirSync(path.join(cache, 'html'))) {
  if (/^[a-f0-9]{64}\.html$/.test(file) && !current.has(file))
    unlinkSync(path.join(cache, 'html', file));
}
console.log(
  `Fiches de mesures : ${ids.length - restored} rendues, ${restored} reprises après vérification des entrées et des ressources.`,
);
