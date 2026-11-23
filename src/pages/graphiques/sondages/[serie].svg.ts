import type { APIRoute, GetStaticPaths } from 'astro';
import { polls, sources } from '../../../lib/data';
import {
  pollGraphic,
  pollGraphicCatalog,
  legacyPollGraphics,
} from '../../../lib/poll-graphic.mjs';

export const getStaticPaths = (() => {
  const current = pollGraphicCatalog(polls);
  return [...current, ...legacyPollGraphics(polls, current)].map(
    ({ id, latest }) => ({
      params: { serie: id },
      props: { latest },
    }),
  );
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(pollGraphic(props.latest, sources, true).svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
