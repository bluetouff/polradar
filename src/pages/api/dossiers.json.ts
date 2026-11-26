import { activeCandidates, sourceById } from '../../lib/data';
import { questions } from '../../lib/questions';
import { voteCasePath } from '../../lib/legislative-votes.mjs';
import {
  voteCases,
  independentVotes,
  historicReceipt,
} from '../../lib/votes-data';
import { proposalTracks, evolution } from '../../lib/proposal-data';

function archiveFields(archive: ReturnType<typeof historicReceipt>) {
  return archive
    ? {
        archiveNominale: {
          identifiantDansAnnexe: archive.archiveId,
          mandat: archive.mandateId,
          groupe: archive.groupId,
          appartenance: archive.groupMembershipId,
          sourceAttribution: archive.confirmationUrl,
        },
      }
    : {};
}

function questionPosition(
  entry: (typeof questions)[number]['entries'][number],
) {
  const { measure, version, author } = entry;
  const { sources: evidence, ...relation } = entry.relation;
  return {
    title: version.snapshot.title,
    description: version.snapshot.description,
    author,
    scope: version.snapshot.scope,
    edition: version.snapshot.edition,
    versionId: version.id,
    measureId: measure.id,
    url: 'https://polradar.fr' + relation.target.url,
    sources: evidence.map(({ id, url, passage }) => {
      const source = sourceById(id);
      return {
        id,
        title: source.title,
        url,
        locator: passage,
        published: source.published,
        publishedYear: source.publishedYear ?? null,
      };
    }),
    relation,
  };
}

export function GET() {
  return Response.json({
    version: 1,
    versionDocuments: evolution.versionDocuments,
    questions: questions.map((q) => ({
      id: q.id,
      title: q.title,
      theme: q.theme,
      url: 'https://polradar.fr' + q.href,
      positions: activeCandidates.map((p) => ({
        candidate: p.id,
        status: q.coverage[p.id] ?? 'non-documente',
        alert: q.alerts[p.id] ?? null,
        positions: q.entries
          .filter((e) => e.candidate.id === p.id)
          .map(questionPosition),
        complements: q.complements
          .filter((e) => e.candidate.id === p.id)
          .map(questionPosition),
        reviews: q.reviews
          .filter((row) => row.candidate === p.id)
          .map((row) => ({
            id: row.sourceId,
            title: row.source.title,
            url: row.source.url,
          })),
      })),
    })),
    votes: [
      ...voteCases.flatMap((v) =>
        v.ballots.map((b) => ({
          id: v.id + '--' + b.id,
          dossier: v.id,
          ballotId: b.id,
          candidate: v.candidate,
          theme: v.measure.theme,
          title: b.title,
          date: b.date,
          chamber: b.chamber,
          context: b.context,
          position: b.position,
          ...archiveFields(historicReceipt(b.id, v.candidate)),
          decision: b.decision,
          tally: b.tally,
          speeches: b.speeches ?? [],
          relation: b.link,
          rectification: b.rectification,
          source: b.source,
          rollCall: b.rollCall,
          measureId: v.measureId,
          versionId: v.versionId,
          url: 'https://polradar.fr' + voteCasePath(v.id),
          measureUrl:
            'https://polradar.fr/mesures/' +
            v.measureId +
            '/#version-' +
            v.version.number,
        })),
      ),
      ...independentVotes.map(
        ({ id, ballot: b, position, source, candidate, archive }) => ({
          id,
          ballotId: b.id,
          candidate: candidate.id,
          theme: null,
          classementThematique: 'non-classe',
          title: b.title,
          date: b.date,
          chamber: b.chamber,
          context: b.context,
          position,
          decision: b.decision,
          tally: b.tally,
          speeches: b.speeches ?? [],
          source: archive ? source : b.source,
          rollCall: source,
          ...archiveFields(archive),
          relation: null,
          measureId: null,
          versionId: null,
          rectification: b.rectification,
          url: 'https://polradar.fr/votes/#' + id,
        }),
      ),
    ],
    evolutions: proposalTracks.flatMap((t) =>
      t.states.slice(1).map((after, i) => ({
        id: t.id + '--' + after.id,
        title: t.title,
        candidate: t.candidate,
        theme: t.theme,
        kind: 'programme',
        date: after.date.value,
        dateKind: after.date.kind,
        dateObservation: after.observedOn,
        versionId:
          evolution.versionDocuments.find((link) => link.stateId === after.id)
            ?.versionId ?? null,
        before: t.states[i],
        after,
        context: t.note,
        measureIds: t.measureIds,
        url: 'https://polradar.fr/evolution/#dossier=' + t.id,
      })),
    ),
  });
}
