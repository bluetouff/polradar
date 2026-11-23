import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('l’historique Git de plus de 1 Mio accepte un ajout et détecte une réécriture', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'polradar-history-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const gitDir = join(cwd, '.git');
  const env = {
    ...process.env,
    GIT_DIR: gitDir,
    GIT_WORK_TREE: cwd,
    GIT_INDEX_FILE: join(gitDir, 'index'),
  };
  const options = { cwd, env, encoding: 'utf8' };
  const directory = join(cwd, 'src', 'data');
  const file = join(directory, 'versions.json');
  await mkdir(directory, { recursive: true });
  const old = { id: 'v1', snapshot: { title: 'é'.repeat(540000) } };
  const initial = JSON.stringify([old]);
  assert.ok(Buffer.byteLength(initial) > 1024 * 1024);
  await writeFile(file, initial);
  execFileSync('git', ['init', '--quiet'], options);
  execFileSync('git', ['add', '--', 'src/data/versions.json'], options);
  const base = execFileSync('git', ['write-tree'], options).trim();
  const script = fileURLToPath(
    new URL('../scripts/check-history.mjs', import.meta.url),
  );
  const check = () =>
    spawnSync(process.execPath, [script], {
      ...options,
      env: { ...env, HISTORY_BASE: base },
    });
  await writeFile(file, JSON.stringify([old, { id: 'v2' }]));
  const added = check();
  assert.equal(added.status, 0, added.stderr);
  await writeFile(
    file,
    JSON.stringify([{ id: 'v1', snapshot: { title: 'Modifié' } }]),
  );
  const rewritten = check();
  assert.equal(rewritten.status, 1);
  assert.match(rewritten.stderr, /v1: ancienne version réécrite/);
});
