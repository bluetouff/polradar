import type { APIRoute } from 'astro';
import { polls, sources } from '../../lib/data';

export const GET: APIRoute = () => {
  const referenced = new Set(
    polls.flatMap((poll) => [
      poll.noticeSource,
      poll.resultSource,
      ...(poll.question?.status === 'verifiee' ? [poll.question.sourceId] : []),
    ]),
  );
  return Response.json({
    polls,
    sources: sources
      .filter(({ id }) => referenced.has(id))
      .map(({ id, url }) => ({ id, url })),
  });
};
