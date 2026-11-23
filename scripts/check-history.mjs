import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { immutableHistoryErrors } from '../src/lib/history.mjs';

const base = process.env.HISTORY_BASE || 'HEAD';
if (base !== 'HEAD' && !/^[a-f0-9]{40}$/.test(base))
  throw Error('Révision de référence invalide');
if (/^0{40}$/.test(base)) {
  console.log('Premier commit : aucune version antérieure.');
  process.exit(0);
}
// Missing Git objects are errors. Only the initial absence of this file is allowed.
for (const [file, key] of [
  ['src/data/versions.json', null],
  ['src/data/proposal-evolution.json', 'states'],
  ['src/data/legislative-votes.json', 'ballots'],
]) {
  const blobSize = execFileSync(
    'git',
    ['ls-tree', '-r', '--format=%(objectsize)', base, '--', file],
    { encoding: 'utf8' },
  ).trim();
  if (!blobSize) {
    console.log('Première intégration de l’historique.');
    continue;
  }
  const bytes = Number(blobSize);
  if (!Number.isSafeInteger(bytes) || bytes <= 0)
    throw Error(`Objet d’historique Git invalide : ${file}`);
  const previous = JSON.parse(
    execFileSync('git', ['cat-file', 'blob', `${base}:${file}`], {
      encoding: 'utf8',
      maxBuffer: bytes,
    }),
  );
  const current = JSON.parse(readFileSync(file, 'utf8'));
  const before = key ? previous[key] : previous;
  const after = key ? current[key] : current;
  const errors = immutableHistoryErrors(before, after);
  if (errors.length) throw Error(errors.join('\n'));
  console.log(`${file} : ${before.length} états antérieurs conservés.`);
}

// Already published image addresses are permanent, including after a redesign.
const archivePaths = execFileSync(
  'git',
  [
    'ls-tree',
    '-r',
    '--name-only',
    base,
    '--',
    'public/graphiques/retraites/editions',
  ],
  { encoding: 'utf8' },
).trim();
for (const filename of archivePaths.split('\n').filter(Boolean)) {
  const hash = /\/([a-f0-9]{64})\.svg$/.exec(filename)?.[1];
  if (
    !hash ||
    createHash('sha256').update(readFileSync(filename)).digest('hex') !== hash
  )
    throw Error('Édition figée modifiée : ' + filename);
}
