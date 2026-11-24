import type { APIRoute, GetStaticPaths } from 'astro';
import {
  archiveGroups,
  archiveIndex,
} from '../../../../lib/parliamentary-archives';
export const getStaticPaths = (() => [
  { params: { periode: 'index' }, props: { data: archiveIndex } },
  ...archiveGroups.map((g) => ({
    params: { periode: g.id },
    props: {
      data: {
        version: 1,
        periode: g.id,
        index: 'https://polradar.fr/api/parlement/archives/index.json',
        scrutins: g.rows,
      },
    },
  })),
]) satisfies GetStaticPaths;
export const GET: APIRoute = ({ props }) => Response.json(props.data);
