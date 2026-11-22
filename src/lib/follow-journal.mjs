import { execFileSync } from 'node:child_process';
import {
  agendaStates,
  ballotStates,
  comparisonChanges,
  measureChanges,
  revisionChanges,
} from './follow-changes.mjs';
const git = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
function historicalFile(sha, name) {
  return JSON.parse(git('show', sha + ':src/data/' + name + '.json'));
}
export function trackedChanges() {
  let complete;
  try {
    complete = git('rev-parse', '--is-shallow-repository') === 'false';
  } catch {
    complete = false;
  }
  if (!complete) return { complete: false, changes: [] };
  const changes = [],
    seenPairs = new Set();
  for (const [kind, file] of [
    ['agenda', 'campaign-agenda'],
    ['vote', 'legislative-votes'],
    ['evolution', 'proposal-evolution'],
  ]) {
    const log = git(
      'log',
      '--first-parent',
      '--reverse',
      '--format=%H%x09%cI',
      '--',
      'src/data/' + file + '.json',
    );
    let previous = new Map();
    for (const line of log.split('\n').filter(Boolean)) {
      const [sha, at] = line.split('\t');
      if (!/^[a-f0-9]{40}$/.test(sha) || !Number.isFinite(Date.parse(at)))
        throw Error('Révision de suivi invalide');
      const model = historicalFile(sha, file);
      if (kind === 'evolution') {
        changes.push(...comparisonChanges(model, seenPairs, at));
        continue;
      }
      const references = historicalFile(
        sha,
        kind === 'agenda' ? 'sources' : 'measures',
      );
      const byId = new Map(references.map((r) => [r.id, r]));
      const current =
        kind === 'agenda'
          ? agendaStates(model, byId)
          : ballotStates(model, byId);
      changes.push(...revisionChanges(kind, previous, current, sha, at));
      previous = current;
    }
  }
  return { complete: true, changes };
}
let cached;
export function followJournal(dataset) {
  if (cached) return cached;
  const { complete, changes } = trackedChanges();
  const days = new Map();
  for (const change of [...measureChanges(dataset), ...changes]) {
    const items = days.get(change.day) ?? [];
    items.push(change);
    days.set(change.day, items);
  }
  for (const entries of days.values())
    entries.sort(
      (a, b) =>
        (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0) ||
        a.id.localeCompare(b.id),
    );
  cached = { complete, days };
  return cached;
}
