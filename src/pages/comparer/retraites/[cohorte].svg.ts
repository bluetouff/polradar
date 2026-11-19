import type { APIRoute, GetStaticPaths } from 'astro';
import comparison from '../../../data/retirement-comparison.json';
import { dataset } from '../../../lib/data';
import {
  retirementComparison,
  retirementUrl,
} from '../../../lib/retirement-comparison.mjs';
import { retirementSvg } from '../../../lib/retirement-svg.mjs';

export const getStaticPaths = (() =>
  comparison.cohorts.map((cohort) => ({
    params: { cohorte: cohort.id },
    props: { cohort },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props, site }) => {
  const { cohort } = props;
  const { panels, programmes } = retirementComparison(
    comparison,
    cohort,
    dataset,
  );
  const url = new URL(retirementUrl(cohort.id), site).href;
  return new Response(
    retirementSvg(cohort, panels, programmes, url, comparison.reviewedOn),
    {
      headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
    },
  );
};
