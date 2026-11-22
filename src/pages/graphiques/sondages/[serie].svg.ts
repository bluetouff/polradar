import type { APIRoute, GetStaticPaths } from 'astro';
import { polls, sources } from '../../../lib/data';
import { pollGraphic, pollGraphicCatalog } from '../../../lib/poll-graphic.mjs';

export const getStaticPaths = (() =>
  pollGraphicCatalog(polls).map(({ id, latest }) => ({
    params: { serie: id },
    props: { latest },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(pollGraphic(props.latest, sources).svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
