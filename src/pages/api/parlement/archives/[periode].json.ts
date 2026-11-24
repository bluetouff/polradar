import type { APIRoute, GetStaticPaths } from 'astro';
import {
  archiveBallots,
  archiveGroups,
  archiveIndex,
} from '../../../../lib/parliamentary-archives';
export const getStaticPaths = (() => [
  { params: { periode: 'index' }, props: { data: archiveIndex } },
  ...(['senat', 'parlement-europeen'] as const).map((institution) => {
    const senate = institution === 'senat';
    const scrutins = archiveBallots.filter(
      (ballot) => ballot.institution === institution,
    );
    const actors = new Set(
      scrutins.flatMap((ballot) =>
        ballot.positions.map((position) => position.personne),
      ),
    );
    return {
      params: { periode: institution },
      props: {
        data: {
          version: 1,
          institution,
          consultation: archiveIndex.consultation,
          droits: archiveIndex.droitsSources[institution],
          periodesExaminees: senate
            ? archiveIndex.sessionsSenat
            : archiveIndex.sessionsEurope,
          lots: archiveIndex.lots.filter(
            (lot) =>
              lot.institution === (senate ? 'Sénat' : 'Parlement européen'),
          ),
          personnes: Object.fromEntries(
            Object.entries(archiveIndex.personnes).filter(([id]) =>
              actors.has(id),
            ),
          ),
          scrutins,
        },
      },
    };
  }),
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
