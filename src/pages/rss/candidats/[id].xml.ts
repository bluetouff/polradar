import { candidates } from '../../../lib/data';
import { rss } from '../../../lib/rss';
import type { APIRoute } from 'astro';
export function getStaticPaths() {
  return candidates.map((candidate) => ({
    params: { id: candidate.id },
    props: { candidate },
  }));
}
export const GET: APIRoute = ({ props }) =>
  rss(`Polradar : ${props.candidate.name}`, { candidate: props.candidate.id });
