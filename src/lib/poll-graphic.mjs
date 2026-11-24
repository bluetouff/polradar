import { createHash } from 'node:crypto';
import {
  comparePollWaves,
  pollSignature,
  legacyPollSignature,
  pollSeries,
} from './features.mjs';
import migration from '../data/poll-graphic-migration.json' with { type: 'json' };
import { renderPollGraphic } from './poll-graphic-view.mjs';

const digest = (text) => createHash('sha256').update(text).digest('hex');
const priorWaves = new Set(
  Object.values(migration).flatMap((entry) => entry.waves),
);

export function pollGraphicSeriesId(poll) {
  const scope = digest(pollSignature(poll));
  const old = digest(legacyPollSignature(poll));
  return 'serie-' + (migration[old]?.scope === scope ? old : scope);
}

/** When a historical scope splits, the old URL resolves to its last published observation. */
export function legacyPollGraphics(polls, current) {
  const active = new Set(current.map((group) => group.id));
  const byId = new Map(polls.map((row) => [row.id, row]));
  return Object.entries(migration)
    .filter(([key]) => !active.has('serie-' + key))
    .map(([key, entry]) => {
      const latest = byId.get(entry.waves.at(-1));
      if (!latest)
        throw new Error('Observation historique de sondage manquante');
      return { id: 'serie-' + key, latest };
    });
}
/** @param {import('./data').Poll[]} polls */
export function pollGraphicCatalog(polls) {
  return pollSeries(polls)
    .map((waves) => ({
      id: pollGraphicSeriesId(waves[0]),
      waves,
      latest: waves[waves.length - 1],
    }))
    .sort((a, b) => comparePollWaves(b.latest, a.latest));
}

// Retrospective tables are drawn in the survey reader. Published image URLs
// continue to follow only the original stream and later routine waves.
export function pollEmbeds(polls) {
  return pollGraphicCatalog(polls.filter((p) => !p.historicalImport));
}

/** @param {import('./data').Poll} poll @param {{id: string, url: string}[]} sourceRows */
export function pollGraphic(
  poll,
  sourceRows,
  documentQuestion = !priorWaves.has(poll.id),
) {
  return renderPollGraphic(poll, sourceRows, documentQuestion);
}
