import type { APIRoute, GetStaticPaths } from 'astro';
import { creditStudioGraphic } from '../../../lib/studio-rights';
import { studioItems } from '../../../lib/studio';
export const getStaticPaths = (() =>
  studioItems
    .filter((i) => i.generated)
    .map((item) => ({
      params: { id: item.id },
      props: { svg: creditStudioGraphic(item.graphic).svg },
    }))) satisfies GetStaticPaths;
export const GET: APIRoute = ({ props }) =>
  new Response(props.svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
