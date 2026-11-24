import { execFileSync } from 'node:child_process';
let sourceCommit = process.env.GITHUB_SHA || null;
if (!sourceCommit) {
  try {
    sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    /* Une prévisualisation locale peut précéder le premier commit. */
  }
}
if (sourceCommit && !/^[a-f0-9]{40}$/.test(sourceCommit))
  throw new Error('Commit de construction invalide');
export { sourceCommit };
