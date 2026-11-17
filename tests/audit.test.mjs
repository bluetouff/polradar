import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  evaluateAudit,
  qualifyContext,
  collectContext,
  requiredFiles,
  auditArgs,
  AuditError,
  parseAuditResult,
} from '../scripts/audit-dependencies.mjs';
const report = JSON.parse(
  readFileSync(
    new URL('./fixtures/npm-audit-picomatch.json', import.meta.url),
    'utf8',
  ),
);
const policy = JSON.parse(
  readFileSync(
    new URL('../.security/audit-qualification.json', import.meta.url),
    'utf8',
  ),
);
const lock = JSON.parse(
  readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'),
);
const context = () => ({
  policy: structuredClone(policy),
  lock: structuredClone(lock),
  digests: { ...policy.files },
  now: Date.parse(policy.reviewedAt) + 1000,
  hasShrinkwrap: false,
});

test('le rapport réel est qualifié avec ses douze chemins et reste visible', () => {
  const result = evaluateAudit(report, context());
  assert.equal(result.exceptionApplied, true);
  assert.equal(result.qualified.length, 12);
  assert.equal(result.counts.high, 12);
  assert.deepEqual(result.blocked, []);
  const reordered = structuredClone(report);
  for (const row of Object.values(reordered.vulnerabilities)) {
    row.nodes.reverse();
    row.via.reverse();
    row.effects.reverse();
  }
  assert.equal(evaluateAudit(reordered, context()).qualified.length, 12);
});

test('un autre avis ou un changement de profil reste bloquant', () => {
  for (const change of [
    (r) => {
      r.vulnerabilities.picomatch.via[0].url =
        'https://github.com/advisories/GHSA-aaaa-bbbb-cccc';
    },
    (r) => {
      r.vulnerabilities.picomatch.via[0].source++;
    },
    (r) => {
      r.vulnerabilities.picomatch.via[0].range = '<=4.0.8';
    },
    (r) => {
      r.vulnerabilities.picomatch.fixAvailable = {
        name: 'picomatch',
        version: '4.0.8',
        isSemVerMajor: false,
      };
    },
    (r) => {
      r.vulnerabilities.astro.effects.push('picomatch');
    },
    (r) => {
      r.vulnerabilities.picomatch.via.push({
        ...r.vulnerabilities.picomatch.via[0],
        url: 'https://github.com/advisories/GHSA-new1-new2-new3',
      });
    },
  ]) {
    const changed = structuredClone(report);
    change(changed);
    assert.ok(evaluateAudit(changed, context()).blocked.length > 0);
  }
});

test('les erreurs, profils inconnus, compteurs invalides et graphes cycliques ne deviennent pas un audit propre', () => {
  for (const invalid of [
    {},
    [],
    { error: { code: 'ENETUNREACH' } },
    { ...report, auditReportVersion: 1 },
  ])
    assert.throws(() => evaluateAudit(invalid, context()), AuditError);
  const badCounts = structuredClone(report);
  badCounts.metadata.vulnerabilities.high = 0;
  assert.throws(() => evaluateAudit(badCounts, context()), AuditError);
  const cyclic = context();
  cyclic.policy.baseline.picomatch.via = ['astro'];
  assert.throws(() => evaluateAudit(report, cyclic), AuditError);
  const unknown = context();
  unknown.policy.baseline.picomatch.extra = 'champ inconnu';
  assert.throws(() => evaluateAudit(report, unknown), AuditError);
  const dangling = structuredClone(report);
  dangling.vulnerabilities.astro.effects.push('nouveau-consommateur');
  assert.throws(() => evaluateAudit(dangling, context()), AuditError);
});

test('une qualification expirée, future ou prolongée exige un réexamen', () => {
  const expires = context();
  expires.now = Date.parse(policy.expiresAt);
  assert.throws(() => evaluateAudit(report, expires), AuditError);
  const future = context();
  future.now = Date.parse(policy.reviewedAt) - 1;
  assert.throws(() => evaluateAudit(report, future), AuditError);
  for (const value of ['2026-13-01T00:00:00.000Z', '2026-11-17', 'inconnu']) {
    const bad = context();
    bad.policy.reviewedAt = value;
    assert.throws(() => evaluateAudit(report, bad), AuditError);
  }
  const extended = context();
  extended.policy.expiresAt = new Date(
    Date.parse(policy.reviewedAt) + 15 * 86400000,
  ).toISOString();
  assert.throws(() => evaluateAudit(report, extended), AuditError);
});

test('toute modification de code, du verrou ou des versions qualifiées bloque l’exception', () => {
  for (const change of [
    (c) => {
      c.digests['astro.config.mjs'] = '0'.repeat(64);
    },
    (c) => {
      c.digests['package-lock.json'] = '0'.repeat(64);
    },
    (c) => {
      c.digests['src/nouvelle-api.ts'] = '0'.repeat(64);
    },
    (c) => {
      delete c.digests['src/lib/features.mjs'];
    },
    (c) => {
      c.hasShrinkwrap = true;
    },
    (c) => {
      c.lock.packages['node_modules/autre/node_modules/picomatch'] = {
        ...c.lock.packages['node_modules/picomatch'],
      };
    },
    (c) => {
      c.lock.packages['node_modules/picomatch'].integrity = 'sha512-different';
    },
    (c) => {
      c.lock.packages['node_modules/picomatch'].version = '4.0.8';
    },
  ]) {
    const changed = context();
    change(changed);
    assert.throws(() => evaluateAudit(report, changed), AuditError);
  }
});

test('un audit réellement propre ne dépend pas de la qualification expirée', () => {
  const clean = structuredClone(report);
  clean.vulnerabilities = {};
  clean.metadata.vulnerabilities = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };
  assert.deepEqual(evaluateAudit(clean).qualified, []);
  assert.equal(evaluateAudit(clean).exceptionApplied, false);
});

test('l’inventaire détecte les nouveaux fichiers de code, suppressions et liens symboliques', async () => {
  const root = await mkdtemp(join(tmpdir(), 'polradar-audit-test-'));
  try {
    for (const path of [...requiredFiles, 'src/extra.ts']) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(
        join(root, path),
        path === 'package-lock.json' ? JSON.stringify(lock) : 'fixture',
      );
    }
    const before = await collectContext(root);
    const qualified = { ...context(), ...before };
    qualified.policy.files = { ...before.digests };
    assert.doesNotThrow(() =>
      qualifyContext(
        qualified.policy,
        before.digests,
        before.lock,
        qualified.now,
        false,
      ),
    );
    await writeFile(join(root, 'src/new-api.ts'), 'fixture');
    const added = await collectContext(root);
    assert.throws(
      () =>
        qualifyContext(
          qualified.policy,
          added.digests,
          added.lock,
          qualified.now,
          false,
        ),
      AuditError,
      parseAuditResult,
    );
    await rm(join(root, 'src/new-api.ts'));
    await rm(join(root, 'src/extra.ts'));
    const removed = await collectContext(root);
    assert.throws(
      () =>
        qualifyContext(
          qualified.policy,
          removed.digests,
          removed.lock,
          qualified.now,
          false,
        ),
      AuditError,
      parseAuditResult,
    );
    await symlink(join(root, 'package.json'), join(root, 'src/link.ts'));
    await assert.rejects(() => collectContext(root), AuditError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('la collecte inclut toutes les dépendances et impose une requête en ligne au registre officiel', () => {
  for (const arg of [
    '--include=dev',
    '--include=optional',
    '--include=peer',
    '--offline=false',
    '--strict-ssl=true',
    '--registry=https://registry.npmjs.org/',
    '--audit-level=moderate',
  ])
    assert.ok(auditArgs.includes(arg));
});

test('une erreur de collecte ou un rapport incohérent ne passe jamais pour un audit propre', () => {
  for (const result of [
    { error: new Error('network'), status: null, stdout: '' },
    { signal: 'SIGTERM', status: null, stdout: '' },
    { status: 2, stdout: JSON.stringify(report) },
    { status: 1, stdout: '{truncated' },
    { status: 0, stdout: JSON.stringify(report) },
  ])
    assert.throws(() => parseAuditResult(result), AuditError);
  assert.equal(
    parseAuditResult({ status: 1, stdout: JSON.stringify(report) })
      .auditReportVersion,
    2,
  );
  const bad = structuredClone(report);
  delete bad.vulnerabilities.picomatch.nodes;
  assert.throws(() => evaluateAudit(bad, context()), AuditError);
});
