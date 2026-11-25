import snapshot from '../data/poll-registry-comparison.json';
import { polls, sources } from './data';
import { catalogue } from './poll-catalogue-data';

const normalize = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const instituteKey = (name: string) =>
  normalize(name)
    .replace(/^toluna(?=harris)/, '')
    .replace(/fiducial$/, '');

const sourceById = new Map(sources.map((source) => [source.id, source]));
const catalogueNumbers = new Map(
  catalogue.rows.map((row) => [row.downloadId, row.number]),
);
const byTerrain = new Map<string, typeof polls>();
const terrainKey = (institute: string, start: string, end: string) =>
  [instituteKey(institute), start, end].join('/');

for (const poll of polls) {
  const key = terrainKey(
    poll.institute,
    poll.fieldworkStart,
    poll.fieldworkEnd,
  );
  const group = byTerrain.get(key) ?? [];
  group.push(poll);
  byTerrain.set(key, group);
}

function noticeNumber(sourceId: string) {
  const url = sourceById.get(sourceId)?.url;
  if (!url) return null;
  const parsed = new URL(url);
  if (
    !['www.commission-des-sondages.fr', 'commission-des-sondages.fr'].includes(
      parsed.hostname,
    )
  )
    return null;
  const path = parsed.pathname;
  return (
    /^\d{4,6}[a-z]?(?=-)/i
      .exec(path.split('/').at(-1) ?? '')?.[0]
      .toLowerCase() ??
    catalogueNumbers.get(/\/add\/(\d+)$/.exec(path)?.[1] ?? '') ??
    null
  );
}

export const registryComparison = {
  checked: snapshot.checked,
  revision: snapshot.revision,
  sha256: snapshot.sha256,
  terrains: snapshot.surveys.map((row) => {
    const candidates =
      byTerrain.get(terrainKey(row.institute, row.start, row.end)) ?? [];
    const related = candidates.filter((poll) => {
      const number = noticeNumber(poll.noticeSource);
      return number !== null && row.notices.includes(number);
    });
    const first = related[0];
    const surveyIds = new Set(related.map((poll) => poll.surveyId ?? poll.id));
    // Plusieurs terrains d’un même dépôt restent distincts jusqu’à relecture.
    const match = first && surveyIds.size === 1 ? first : null;
    const local = match
      ? candidates.filter(
          (poll) => (poll.surveyId ?? poll.id) === (match.surveyId ?? match.id),
        )
      : [];
    return {
      ...row,
      match,
      candidates: candidates.length,
      localNotices: [
        ...new Set(local.map((poll) => noticeNumber(poll.noticeSource))),
      ].filter(Boolean),
      localScenarios: local.length,
      officialUrl: match ? sourceById.get(match.noticeSource)?.url : undefined,
      classifiedOutsideVoting: row.notices.includes('10228'),
    };
  }),
};
