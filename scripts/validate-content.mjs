import { readFile } from 'node:fs/promises';
import { validateDataset } from '../src/lib/schema.mjs';

const names = [
  'candidates',
  'themes',
  'sources',
  'engagements',
  'events',
  'polls',
  'budget',
];
const entries = await Promise.all(
  names.map(async (name) => [
    name,
    JSON.parse(
      await readFile(
        new URL(`../src/data/${name}.json`, import.meta.url),
        'utf8',
      ),
    ),
  ]),
);
const errors = validateDataset(Object.fromEntries(entries));
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  'Corpus valide : références, dates, archives, unités et cohérence budgétaire.',
);
