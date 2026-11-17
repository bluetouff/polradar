import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { immutableHistoryErrors } from '../src/lib/history.mjs';

const base = process.env.HISTORY_BASE || 'HEAD';
if (base !== 'HEAD' && !/^[a-f0-9]{40}$/.test(base))
  throw Error('Révision de référence invalide');
if (/^0{40}$/.test(base)) {
  console.log('Premier commit : aucune version antérieure.');
  process.exit(0);
}
// Missing Git objects are errors. Only the initial absence of this file is allowed.
const files = execFileSync(
  'git',
  ['ls-tree', '-r', '--name-only', base, '--', 'src/data/versions.json'],
  { encoding: 'utf8' },
);
if (!files.trim()) {
  console.log('Première intégration de l’historique.');
  process.exit(0);
}
const previous = JSON.parse(
  execFileSync('git', ['show', `${base}:src/data/versions.json`], {
    encoding: 'utf8',
  }),
);
const current = JSON.parse(readFileSync('src/data/versions.json', 'utf8'));
const errors = immutableHistoryErrors(previous, current);
if (errors.length) throw Error(errors.join('\n'));
console.log(`${previous.length} versions antérieures conservées.`);
