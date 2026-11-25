import type { DocumentedPoll } from './data';
import { renderPollGraphic } from './poll-graphic-view.mjs';
import { creditStudioGraphic, studioRights } from './studio-rights';

export type PollArchiveData = {
  polls: DocumentedPoll[];
  sources: { id: string; url: string }[];
};

export async function archivePollPublication(
  id: string,
  pollId: string,
  site: string,
  data: PollArchiveData,
) {
  const poll = data.polls.find(
    (row) => row.id === pollId && row.historicalImport,
  );
  if (!poll) throw new Error('Scénario de sondage absent');
  const graphic = creditStudioGraphic(renderPollGraphic(poll, data.sources));
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(graphic.svg),
    ),
  );
  const edition = Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return {
    id,
    graphic,
    rights: studioRights,
    edition,
    pageUrl: new URL(graphic.page, site).href,
    columns: [
      'Candidat testé',
      'Intentions exprimées (%)',
      'En dessous de (%)',
      'Hypothèse',
      'Début du terrain',
      'Fin du terrain',
      'Publication',
      'Source des résultats',
    ],
    rows: poll.results.map((result) => [
      result.name,
      result.percentage,
      result.below ?? null,
      poll.scenario,
      poll.fieldworkStart,
      poll.fieldworkEnd,
      poll.published,
      poll.resultSource ? graphic.sources[1].url : graphic.sources[0].url,
    ]),
  };
}
