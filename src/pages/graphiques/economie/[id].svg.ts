import type { APIRoute, GetStaticPaths } from 'astro';
import { economy } from '../../../lib/economy-data';
import { economyGraphic } from '../../../lib/economy-graphic.mjs';

export const getStaticPaths = (() =>
  economy.map(({ id }) => ({ params: { id } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) =>
  new Response(economyGraphic(economy, params.id).svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
