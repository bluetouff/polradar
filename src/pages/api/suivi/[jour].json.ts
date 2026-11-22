import type { APIRoute, GetStaticPaths } from 'astro';
import { dataset } from '../../../lib/data';
import { followJournal } from '../../../lib/follow-journal.mjs';
export const getStaticPaths = (() =>
  Array.from(followJournal(dataset).days, ([jour, entries]) => ({
    params: { jour },
    props: { entries },
  }))) satisfies GetStaticPaths;
export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.entries), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
