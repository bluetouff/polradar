import type { APIRoute, GetStaticPaths } from 'astro';
import {
  ballotsByMonth,
  registerIndex,
  registerMonth,
} from '../../../lib/parliamentary-register';
export const getStaticPaths = (() =>
  ['index', ...ballotsByMonth.keys()].map((periode) => ({
    params: { periode },
  }))) satisfies GetStaticPaths;
export const GET: APIRoute = ({ params }) =>
  Response.json(
    params.periode === 'index' ? registerIndex : registerMonth(params.periode!),
  );
