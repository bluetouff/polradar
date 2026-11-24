import type { APIRoute, GetStaticPaths } from 'astro';
import { studioItems, studioPublication } from '../../../lib/studio';
export const getStaticPaths = (() =>
  studioItems.map((item) => ({
    params: { id: item.id },
    props: { item },
  }))) satisfies GetStaticPaths;
export const GET: APIRoute = ({ props }) =>
  Response.json(studioPublication(props.item));
