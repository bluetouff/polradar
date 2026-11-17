import { themes } from '../../../lib/data';
import { rss } from '../../../lib/rss';
import type { APIRoute } from 'astro';
export function getStaticPaths() {
  return themes.map((theme) => ({
    params: { id: theme.id },
    props: { theme },
  }));
}
export const GET: APIRoute = ({ props }) =>
  rss(`Polradar : ${props.theme.label}`, { theme: props.theme.id });
