import { readFile } from 'node:fs/promises';
import { validateDataset, validateFeatures } from '../src/lib/schema.mjs';
import { marketSnapshotSchema } from '../src/lib/markets.mjs';
import { airtimeSchema } from '../src/lib/airtime.mjs';
import {
  digitalComparisonSchema,
  validateDigitalComparison,
} from '../src/lib/digital-comparison.mjs';
import {
  legislativeVotesSchema,
  validateLegislativeReferences,
} from '../src/lib/legislative-votes.mjs';
import {
  evolutionSchema,
  financingSchema,
  validateProposalReferences,
} from '../src/lib/proposal-evidence.mjs';
import {
  programmeBudgetSchema,
  agendaSchema,
  mapSchema,
  validateVisualReferences,
} from '../src/lib/campaign-visuals.mjs';

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
const visualDatasets = [];
for (const [name, schema] of [
  ['programme-budgets', programmeBudgetSchema],
  ['campaign-agenda', agendaSchema],
  ['france-map', mapSchema],
  ['airtime', airtimeSchema],
]) {
  visualDatasets.push(
    schema.parse(
      JSON.parse(
        await readFile(
          new URL(`../src/data/${name}.json`, import.meta.url),
          'utf8',
        ),
      ),
    ),
  );
}
const visualErrors = validateVisualReferences(
  visualDatasets[0],
  visualDatasets[1],
  dataset.candidates,
  dataset.sources,
);
marketSnapshotSchema.parse(
  JSON.parse(
    await readFile(
      new URL('../src/data/prediction-markets.json', import.meta.url),
      'utf8',
    ),
  ),
);
const errors = [
  ...validateDataset(dataset),
  ...validateFeatures(dataset),
  ...visualErrors,
];
errors.push(
  ...validateDigitalComparison(
    digitalComparisonSchema.parse(
      JSON.parse(
        await readFile(
          new URL('../src/data/digital-comparison.json', import.meta.url),
          'utf8',
        ),
      ),
    ),
    dataset,
  ),
);
errors.push(
  ...validateLegislativeReferences(
    legislativeVotesSchema.parse(
      JSON.parse(
        await readFile(
          new URL('../src/data/legislative-votes.json', import.meta.url),
          'utf8',
        ),
      ),
    ),
    dataset,
  ),
);
const evidence = await Promise.all(
  ['proposal-evolution', 'financing-maps'].map(async (name) =>
    JSON.parse(
      await readFile(
        new URL(`../src/data/${name}.json`, import.meta.url),
        'utf8',
      ),
    ),
  ),
);
errors.push(
  ...validateProposalReferences(
    evolutionSchema.parse(evidence[0]),
    financingSchema.parse(evidence[1]),
    dataset,
    visualDatasets[0],
  ),
);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  'Corpus valide : références, dates, archives, unités et cohérence budgétaire.',
);
