import rows from '../data/legislative-votes.json';
import {
  legislativeVotesSchema,
  validateLegislativeReferences,
} from './legislative-votes.mjs';
import { dataset } from './data';
export const legislativeVotes = legislativeVotesSchema.parse(rows);
const errors = validateLegislativeReferences(legislativeVotes, dataset);
if (errors.length) throw new Error(errors.join('\n'));
const readingSources = new Map(
  legislativeVotes.readingSources.map((s) => [s.ballotId, s]),
);
export const voteCases = legislativeVotes.cases.map((record) => ({
  ...record,
  candidateRecord: dataset.candidates.find((c) => c.id === record.candidate)!,
  measure: dataset.measures.find((m) => m.id === record.measureId)!,
  version: dataset.versions.find((v) => v.id === record.versionId)!,
  ballots: record.links
    .map((link) => {
      const ballot = legislativeVotes.ballots.find(
        (b) => b.id === link.ballotId,
      )!;
      return {
        ...ballot,
        rollCall: readingSources.get(ballot.id) ?? ballot.source,
        link,
        position: ballot.positions.find(
          (p) => p.candidate === record.candidate,
        )!,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date)),
}));
