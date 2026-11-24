import type { APIRoute, GetStaticPaths } from 'astro';
import { studioItems, studioPublicationSvg } from '../../../lib/studio';
export const getStaticPaths = (() =>
  studioItems
    .filter((i) => i.generated)
    .map((item) => ({
      params: { id: item.id },
      props: { svg: studioPublicationSvg(item) },
    }))) satisfies GetStaticPaths;
export const GET: APIRoute = ({ props }) =>
  new Response(props.svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
