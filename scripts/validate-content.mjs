import { readFile } from 'node:fs/promises';
import { validateDataset, validateFeatures } from '../src/lib/schema.mjs';
import { marketSnapshotSchema } from '../src/lib/markets.mjs';

const names = [
  'candidates',
  'themes',
  'sources',
  'engagements',
  'events',
  'polls',
  'budget',
  'meta',
  'measures',
  'versions',
  'watch',
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
const dataset = Object.fromEntries(entries);
marketSnapshotSchema.parse(
  JSON.parse(
    await readFile(
      new URL('../src/data/prediction-markets.json', import.meta.url),
      'utf8',
    ),
  ),
);
const errors = [...validateDataset(dataset), ...validateFeatures(dataset)];
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  'Corpus valide : références, dates, archives, unités et cohérence budgétaire.',
);
