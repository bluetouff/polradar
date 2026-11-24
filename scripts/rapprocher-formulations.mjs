import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { proposalWording } from '../src/lib/proposal-wording.mjs';

const names = [
  'measures',
  'candidates',
  'sources',
  'versions',
  'document-authors',
  'meta',
];
const files = await Promise.all(
  names.map(async (name) => {
    const raw = await readFile(
      new URL('../src/data/' + name + '.json', import.meta.url),
    );
    return [
      name,
      JSON.parse(raw),
      createHash('sha256').update(raw).digest('hex'),
    ];
  }),
);
const corpus = Object.fromEntries(files.map(([name, data]) => [name, data]));
process.stdout.write(
  JSON.stringify(
    {
      version: 1,
      edition: corpus.meta.edition,
      fichiersSha256: Object.fromEntries(
        files.map(([name, , sha]) => [name + '.json', sha]),
      ),
      ...proposalWording(corpus),
    },
    null,
    2,
  ) + '\n',
);
