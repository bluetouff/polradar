import { sourceCommit } from '../../scripts/release-revision.mjs';
import history from '../data/daily-updates.json';
import { corpusCounts, identicalProposals } from './corpus-counts.mjs';
import { dailyHistorySchema, latestCollections } from './daily-updates.mjs';
import { dataset, meta } from './data';
import { documents } from './documents';
import { pollCoverage } from './features.mjs';
import { searchIndex } from './parliament-search';
import { chamberLabels } from './parliament-search-types';
import { parliamentaryCoverage } from './parliamentary-coverage';
import { catalogue, noticeRows } from './poll-catalogue-data';

export const documentaryCounts = corpusCounts(dataset);

const statuses = new Map<string, number>();
for (const candidate of dataset.candidates)
  statuses.set(candidate.status, (statuses.get(candidate.status) ?? 0) + 1);

const sources = {
  catalogue: documents.length,
  withPassages: 0,
  checked: 0,
  blocked: 0,
  unavailable: 0,
};
const reviewed = { sections: 0, units: 0, linkedUnits: 0 };
for (const document of documents) {
  if (document.measureCount > 0) sources.withPassages++;
  if (document.watch) sources.checked++;
  if (document.watch?.status === 'bloque') sources.blocked++;
  if (document.watch?.status === 'indisponible') sources.unavailable++;
  if (document.coverage) {
    reviewed.sections++;
    reviewed.units += document.coverage.total;
    reviewed.linkedUnits += document.coverage.linked;
  }
}

const notices = {
  integree: 0,
  hors_series: 0,
  partielle: 0,
  a_relire: 0,
  identifiee: 0,
  non_pertinente: 0,
  format: 0,
  inaccessible: 0,
};
for (const notice of noticeRows) {
  if (!Object.hasOwn(notices, notice.status))
    throw Error('Statut de notice non reconnu : ' + notice.status);
  notices[notice.status as keyof typeof notices]++;
}

const institutions = new Map(
  Object.entries(chamberLabels).map(([id, label]) => [
    id,
    { id, label, acts: 0, ballots: 0, ballotsWithTrackedVote: 0 },
  ]),
);
for (const act of searchIndex.actes) {
  const summary = institutions.get(act.institution);
  if (!summary) throw Error('Institution non reconnue : ' + act.institution);
  summary.acts++;
  if (act.nature !== 'vote') continue;
  summary.ballots++;
  if (act.mentions.some(([, , kind]) => kind === 'vote'))
    summary.ballotsWithTrackedVote++;
}

export const documentaryHealth = {
  version: 1,
  sourceCommit,
  corpusUpdated: meta.corpusUpdated,
  candidates: {
    total: dataset.candidates.length,
    withdrawn: dataset.candidates.filter((c) => c.withdrawnOn).length,
    byStatus: Array.from(statuses, ([status, count]) => ({
      status,
      count,
    })).sort(
      (a, b) => b.count - a.count || a.status.localeCompare(b.status, 'fr'),
    ),
  },
  measures: {
    total: documentaryCounts.total,
    byScope: documentaryCounts.counts,
    withoutSource: dataset.measures.filter((m) => m.sourceRefs.length === 0)
      .length,
    versions: dataset.versions.length,
    identicalWording: identicalProposals(dataset.measures),
  },
  sources,
  reviewed,
  polls: {
    ...pollCoverage(dataset.polls),
    catalogue: {
      total: noticeRows.length,
      byStatus: notices,
      checkedAt: catalogue.checkedAt,
      lastSuccessAt: catalogue.lastSuccessAt,
    },
  },
  parliament: {
    acts: searchIndex.actes.length,
    byInstitution: [...institutions.values()].map((institution) => {
      const lots = parliamentaryCoverage.byPeriod.filter(
        (lot) => lot.institution === institution.id,
      );
      return {
        ...institution,
        examinedArchiveBallots: lots.reduce(
          (sum, lot) => sum + lot.examined,
          0,
        ),
        archiveBallotsWithPosition: lots.reduce(
          (sum, lot) => sum + lot.recorded,
          0,
        ),
      };
    }),
    ...parliamentaryCoverage,
  },
  collections: latestCollections(dailyHistorySchema.parse(history)).map(
    ({ row, run, attempted, succeeded }) => ({
      id: row.id,
      scope: run.scope ?? 'complete',
      attempted,
      succeeded,
      dataDate: row.dataDate,
      status: row.status,
      incidents: row.incidents.length,
    }),
  ),
};
