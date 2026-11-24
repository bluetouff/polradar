import type { APIRoute, GetStaticPaths } from 'astro';
import { polls, sources } from '../../../lib/data';
import { economy } from '../../../lib/economy-data';
import { salaryGraphic } from '../../../lib/csg-paie.mjs';
import { editionId } from '../../../lib/chart-publication';
import { pollGraphic } from '../../../lib/poll-graphic.mjs';
import { economyGraphic } from '../../../lib/economy-graphic.mjs';

export const getStaticPaths = (() =>
  [
    salaryGraphic(),
    ...polls
      .filter((poll) => !poll.historicalImport)
      .map((poll) => pollGraphic(poll, sources)),
    ...economy.map(({ id }) => economyGraphic(economy, id)),
  ].map((graphic) => ({
    params: { empreinte: editionId(graphic) },
    props: { svg: graphic.svg },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(props.svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
