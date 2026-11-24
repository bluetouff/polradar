import { activeCandidates } from '../../lib/data';
import { questions } from '../../lib/questions';
import { voteCases } from '../../lib/votes-data';
import { proposalTracks } from '../../lib/proposal-data';

export function GET() {
  return Response.json({
    version: 1,
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
          .map((e) => ({
            title: e.version.snapshot.title,
            description: e.version.snapshot.description,
            author: e.author,
            scope: e.version.snapshot.scope,
            edition: e.version.snapshot.edition,
            versionId: e.version.id,
            measureId: e.measure.id,
            url:
              'https://polradar.fr/mesures/' +
              e.measure.id +
              '/#version-' +
              e.version.number,
            sources: e.refs.map(({ source, sourceId, locator, fragment }) => ({
              id: sourceId,
              title: source.title,
              url: fragment
                ? source.url.split('#')[0] + '#' + fragment
                : source.url,
              locator,
              published: source.published,
              publishedYear: source.publishedYear ?? null,
            })),
          })),
        reviews: q.reviews
          .filter((row) => row.candidate === p.id)
          .map((row) => ({
            id: row.sourceId,
            title: row.source.title,
            url: row.source.url,
          })),
      })),
    })),
    votes: voteCases.flatMap((v) =>
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
        decision: b.decision,
        tally: b.tally,
        relation: b.link,
        rectification: b.rectification,
        source: b.source,
        rollCall: b.rollCall,
        measureId: v.measureId,
        versionId: v.versionId,
        url: 'https://polradar.fr/votes/#dossier=' + v.id,
        measureUrl:
          'https://polradar.fr/mesures/' +
          v.measureId +
          '/#version-' +
          v.version.number,
      })),
    ),
    evolutions: proposalTracks.flatMap((t) =>
      t.states.slice(1).map((after, i) => ({
        id: t.id + '--' + after.id,
        title: t.title,
        candidate: t.candidate,
        theme: t.theme,
        kind: 'programme',
        date: after.date.value,
        dateKind: after.date.kind,
        before: t.states[i],
        after,
        context: t.note,
        measureIds: t.measureIds,
        url: 'https://polradar.fr/evolution/#dossier=' + t.id,
      })),
    ),
  });
}
