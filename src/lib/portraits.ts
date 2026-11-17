import rows from '../data/portraits.json';
import { candidates } from './data';
import { parsePortraits } from './portrait-schema.mjs';
import { portraitAssets } from './portrait-assets';

export const portraits = parsePortraits(rows, candidates);
for (const portrait of portraits) {
  if (!Object.hasOwn(portraitAssets, portrait.file))
    throw new Error('Image de portrait absente');
}
export const portraitByCandidate = new Map(
  portraits.map((row) => [row.candidate, row]),
);
export function portraitFor(id: string) {
  const credit = portraitByCandidate.get(id);
  return credit ? { credit, image: portraitAssets[credit.file] } : undefined;
}
