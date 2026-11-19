import type { APIRoute, GetStaticPaths } from 'astro';
import { menuAssets } from '../../lib/menu-sprite';
export const getStaticPaths = (() =>
  menuAssets.map(({ file, mime, body }) => ({
    params: { file },
    props: { mime, body },
  }))) satisfies GetStaticPaths;
export const GET: APIRoute = ({ props }) =>
  new Response(props.body, {
    headers: { 'Content-Type': props.mime + ';charset=utf-8' },
  });
