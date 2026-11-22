import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  frozenGraphicPath,
  retirementCard,
} from '../src/lib/retirement-embed.mjs';
const read = (name) =>
  JSON.parse(
    readFileSync(
      new URL('../src/data/' + name + '.json', import.meta.url),
      'utf8',
    ),
  );
const comparison = read('retirement-comparison');
const data = Object.fromEntries(
  ['candidates', 'measures', 'versions', 'sources'].map((name) => [
    name,
    read(name),
  ]),
);
mkdirSync(
  new URL('../public/graphiques/retraites/editions/', import.meta.url),
  { recursive: true },
);
for (const cohort of comparison.cohorts) {
  const { svg } = retirementCard(comparison, cohort, data);
  const file = new URL('../public' + frozenGraphicPath(svg), import.meta.url);
  try {
    writeFileSync(file, svg, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST' || readFileSync(file, 'utf8') !== svg)
      throw error;
  }
}
