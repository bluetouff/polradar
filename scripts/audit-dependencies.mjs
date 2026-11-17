import { readFile, readdir, lstat, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

export const advisoryUrl = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
export const requiredFiles = [
  'package.json',
  'package-lock.json',
  'astro.config.mjs',
  'src/content.config.ts',
  'scripts/package-release.py',
  'src/lib/features.mjs',
  'src/scripts/search.ts',
  'src/scripts/ui.ts',
  'src/scripts/campaign.ts',
  'src/scripts/markets.ts',
  'scripts/audit-dependencies.mjs',
];
export const auditArgs = [
  'audit',
  '--json',
  '--audit-level=moderate',
  '--include=dev',
  '--include=optional',
  '--include=peer',
  '--offline=false',
  '--prefer-online',
  '--strict-ssl=true',
  '--workspaces=false',
  '--registry=https://registry.npmjs.org/',
];
const codeExtensions = new Set([
  '.astro',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.mts',
  '.cts',
  '.py',
  '.mdx',
]);
const levels = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const maxReviewAge = 14 * 24 * 60 * 60 * 1000;
export class AuditError extends Error {}
const fail = (message) => {
  throw new AuditError(message);
};
const object = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function canonical(value) {
  if (Array.isArray(value))
    return '[' + value.map(canonical).sort().join(',') + ']';
  if (object(value))
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonical(value[key]))
        .join(',') +
      '}'
    );
  if (!['string', 'number', 'boolean'].includes(typeof value) && value !== null)
    fail('Donnée npm non JSON.');
  if (typeof value === 'number' && !Number.isFinite(value))
    fail('Nombre npm invalide.');
  return JSON.stringify(value);
}
const same = (left, right) => canonical(left) === canonical(right);

function validateProfile(profile, approved = false) {
  const checked = new Set();
  const text = (value) =>
    typeof value === 'string' && value.length > 0 && value.length <= 5000;
  function visit(name, active = new Set()) {
    if (!Object.hasOwn(profile, name) || active.has(name) || active.size > 128)
      fail('Chaîne npm incomplète ou cyclique.');
    if (checked.has(name)) return;
    const row = profile[name];
    if (
      !object(row) ||
      row.name !== name ||
      !Object.hasOwn(levels, row.severity) ||
      (approved && row.severity !== 'high') ||
      !same(Object.keys(row), [
        'name',
        'severity',
        'isDirect',
        'via',
        'effects',
        'range',
        'nodes',
        'fixAvailable',
      ]) ||
      typeof row.isDirect !== 'boolean' ||
      !text(row.range) ||
      !Array.isArray(row.nodes) ||
      !row.nodes.length ||
      row.nodes.some(
        (node) =>
          !text(node) ||
          !node.startsWith('node_modules/') ||
          node.split('/').includes('..') ||
          node.includes('\\'),
      ) ||
      !Array.isArray(row.effects) ||
      row.effects.some(
        (effect) => !text(effect) || !Object.hasOwn(profile, effect),
      ) ||
      !Array.isArray(row.via) ||
      !row.via.length
    )
      fail('Profil npm invalide.');
    if (
      typeof row.fixAvailable !== 'boolean' &&
      (!object(row.fixAvailable) ||
        !same(Object.keys(row.fixAvailable), [
          'name',
          'version',
          'isSemVerMajor',
        ]) ||
        !text(row.fixAvailable.name) ||
        !text(row.fixAvailable.version) ||
        typeof row.fixAvailable.isSemVerMajor !== 'boolean')
    )
      fail('Correctif npm invalide.');
    const next = new Set(active);
    next.add(name);
    for (const via of row.via) {
      if (typeof via === 'string') {
        visit(via, next);
        continue;
      }
      if (
        !object(via) ||
        !same(Object.keys(via), [
          'source',
          'name',
          'dependency',
          'title',
          'url',
          'severity',
          'cwe',
          'cvss',
          'range',
        ]) ||
        !Number.isSafeInteger(via.source) ||
        via.source <= 0 ||
        !text(via.name) ||
        !text(via.dependency) ||
        !text(via.title) ||
        !text(via.url) ||
        !text(via.range) ||
        !Object.hasOwn(levels, via.severity) ||
        !Array.isArray(via.cwe) ||
        via.cwe.some((item) => !text(item)) ||
        !object(via.cvss) ||
        !same(Object.keys(via.cvss), ['score', 'vectorString']) ||
        !Number.isFinite(via.cvss.score) ||
        via.cvss.score < 0 ||
        via.cvss.score > 10 ||
        !(via.cvss.vectorString === null || text(via.cvss.vectorString))
      )
        fail('Avis npm invalide.');
      if (
        approved &&
        (name !== 'picomatch' ||
          via.name !== 'picomatch' ||
          via.dependency !== 'picomatch' ||
          via.url !== advisoryUrl ||
          via.source !== 1247710 ||
          via.range !== '<=4.0.7' ||
          via.severity !== 'high')
      )
        fail('Un autre avis nécessite une qualification.');
    }
    checked.add(name);
  }
  for (const name of Object.keys(profile)) visit(name);
}

export function inspectReport(report) {
  if (
    !object(report) ||
    report.auditReportVersion !== 2 ||
    report.error ||
    !same(Object.keys(report), [
      'auditReportVersion',
      'vulnerabilities',
      'metadata',
    ]) ||
    !object(report.vulnerabilities) ||
    !object(report.metadata?.vulnerabilities)
  )
    fail('Rapport npm absent ou invalide.');
  validateProfile(report.vulnerabilities);
  const entries = Object.entries(report.vulnerabilities);
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const [, row] of entries) counts[row.severity]++;
  if (
    !same(Object.keys(report.metadata.vulnerabilities), [
      ...Object.keys(counts),
      'total',
    ]) ||
    Object.entries(counts).some(
      ([key, value]) => report.metadata.vulnerabilities[key] !== value,
    ) ||
    report.metadata.vulnerabilities.total !== entries.length
  )
    fail('Comptage npm incohérent.');
  return {
    counts,
    blocking: Object.fromEntries(
      entries.filter(([, row]) => levels[row.severity] >= levels.moderate),
    ),
  };
}

function validateBaseline(baseline) {
  if (
    !object(baseline) ||
    Object.keys(baseline).length !== 12 ||
    !Object.hasOwn(baseline, 'picomatch')
  )
    fail('Périmètre d’avis non qualifié.');
  validateProfile(baseline, true);
}

export function parseAuditResult(result) {
  if (
    result.error ||
    result.signal ||
    ![0, 1].includes(result.status) ||
    typeof result.stdout !== 'string'
  )
    fail('Audit npm indisponible.');
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    fail('Réponse npm JSON invalide.');
  }
  const overview = inspectReport(report);
  if ((result.status === 0) !== (Object.keys(overview.blocking).length === 0))
    fail('Code de retour npm incohérent.');
  return report;
}

export function qualifyContext(policy, digests, lock, now, hasShrinkwrap) {
  if (
    !object(policy) ||
    policy.schemaVersion !== 1 ||
    policy.advisory !== advisoryUrl ||
    policy.source !== 1247710 ||
    policy.disposition !== 'not-applicable-to-public-inputs'
  )
    fail('Qualification inconnue.');
  const validTime = (value) =>
    typeof value === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
  if (!validTime(policy.reviewedAt) || !validTime(policy.expiresAt))
    fail('Dates de qualification invalides.');
  const reviewed = Date.parse(policy.reviewedAt),
    expires = Date.parse(policy.expiresAt);
  if (
    !Number.isFinite(now) ||
    reviewed > now ||
    expires <= now ||
    expires <= reviewed ||
    expires - reviewed > maxReviewAge
  )
    fail('Qualification expirée ou dates invalides.');
  if (hasShrinkwrap !== false)
    fail('Un shrinkwrap empêche cette qualification.');
  if (
    !object(policy.files) ||
    !object(digests) ||
    !same(Object.keys(policy.files), Object.keys(digests)) ||
    requiredFiles.some((path) => !Object.hasOwn(policy.files, path))
  )
    fail('Inventaire des sources de code modifié.');
  for (const path of Object.keys(policy.files)) {
    if (
      !/^[a-f0-9]{64}$/.test(policy.files[path]) ||
      digests[path] !== policy.files[path]
    )
      fail('Un fichier de la frontière de sécurité a changé.');
  }
  if (
    !object(lock?.packages) ||
    !Array.isArray(policy.dependencies) ||
    policy.dependencies.length !== 2
  )
    fail('Dépendances qualifiées invalides.');
  const paths = Object.keys(lock.packages)
    .filter((path) => path.endsWith('/picomatch'))
    .sort();
  if (
    !same(
      paths,
      policy.dependencies.map((row) => row.path),
    )
  )
    fail('Le graphe picomatch a changé.');
  for (const row of policy.dependencies) {
    const actual = lock.packages[row.path];
    if (
      !object(actual) ||
      !['2.3.2', '4.0.7'].includes(row.version) ||
      !row.resolved?.startsWith('https://registry.npmjs.org/picomatch/-/') ||
      !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(row.integrity || '') ||
      actual.version !== row.version ||
      actual.resolved !== row.resolved ||
      actual.integrity !== row.integrity
    )
      fail('Une version ou une empreinte de dépendance a changé.');
  }
  return paths;
}

export function evaluateAudit(report, context = {}) {
  const { counts, blocking } = inspectReport(report);
  if (!Object.keys(blocking).length)
    return { qualified: [], blocked: [], counts, exceptionApplied: false };
  validateBaseline(context.policy?.baseline);
  if (!same(blocking, context.policy.baseline))
    return {
      qualified: [],
      blocked: Object.keys(blocking),
      counts,
      exceptionApplied: false,
    };
  const paths = qualifyContext(
    context.policy,
    context.digests,
    context.lock,
    context.now,
    context.hasShrinkwrap,
  );
  if (!same(report.vulnerabilities.picomatch.nodes, paths))
    fail('Les chemins picomatch de l’avis ont changé.');
  return {
    qualified: Object.keys(blocking),
    blocked: [],
    counts,
    exceptionApplied: true,
  };
}

export async function collectContext(root) {
  const files = new Set(requiredFiles);
  async function walk(relative) {
    for (const entry of await readdir(join(root, relative), {
      withFileTypes: true,
    })) {
      const path = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink())
        fail('Lien symbolique dans les sources de code.');
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && codeExtensions.has(extname(entry.name)))
        files.add(path);
    }
  }
  await walk('src');
  await walk('scripts');
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (codeExtensions.has(extname(entry.name))) files.add(entry.name);
  }
  let hasShrinkwrap = false;
  try {
    await lstat(join(root, 'npm-shrinkwrap.json'));
    hasShrinkwrap = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const digests = Object.create(null);
  let lock;
  for (const path of [...files].sort()) {
    const file = join(root, path);
    if (!(await lstat(file)).isFile())
      fail('Fichier qualifié absent ou non ordinaire.');
    const bytes = await readFile(file);
    digests[path] = createHash('sha256').update(bytes).digest('hex');
    if (path === 'package-lock.json') lock = JSON.parse(bytes.toString('utf8'));
  }
  return { digests, lock, hasShrinkwrap };
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync('npm', auditArgs, {
    cwd: root,
    encoding: 'utf8',
    timeout: 45000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const report = parseAuditResult(result);
  const overview = inspectReport(report);
  // Preserve the valid raw report, including qualified findings. Collection
  // errors are never published as an empty or successful audit.
  await mkdir('artifacts', { recursive: true });
  await writeFile(
    'artifacts/dependency-audit.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  let summary, policy;
  if (Object.keys(overview.blocking).length) {
    policy = JSON.parse(
      await readFile(join(root, '.security/audit-qualification.json'), 'utf8'),
    );
    const context = await collectContext(root);
    summary = evaluateAudit(report, { ...context, policy, now: Date.now() });
  } else summary = evaluateAudit(report);
  console.log(
    JSON.stringify(
      {
        npmFindings: summary.counts,
        qualifiedPackages: summary.qualified,
        blockingPackages: summary.blocked,
        qualification: summary.exceptionApplied ? advisoryUrl : null,
        upstreamPatched: summary.exceptionApplied ? false : null,
        expiresAt: summary.exceptionApplied ? policy.expiresAt : null,
      },
      null,
      2,
    ),
  );
  if (summary.blocked.length) process.exitCode = 1;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      error instanceof AuditError
        ? error.message
        : 'Audit impossible : réponse ou fichier de qualification invalide.',
    );
    process.exitCode = 2;
  });
}
