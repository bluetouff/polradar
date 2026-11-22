import type { APIRoute, GetStaticPaths } from 'astro';
import comparison from '../../../data/retirement-comparison.json';
import { dataset } from '../../../lib/data';
import { retirementCard } from '../../../lib/retirement-embed.mjs';
export const getStaticPaths = (() =>
  comparison.cohorts.map((cohort) => ({
    params: { cohorte: cohort.id },
    props: { cohort },
  }))) satisfies GetStaticPaths;
export const GET: APIRoute = ({ props }) =>
  new Response(retirementCard(comparison, props.cohort, dataset).svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
