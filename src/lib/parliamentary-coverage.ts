import { archiveBallots, archiveMetadata } from './parliamentary-archives';
import { complementXVII, register } from './parliamentary-register';

const assemblyBallots = [...register.scrutins, ...complementXVII];

function checkedCounts(examined: number, recorded: number) {
  if (!Number.isSafeInteger(examined) || recorded < 0 || examined < recorded)
    throw new Error('Périmètre des positions parlementaires incohérent');
  return { examined, recorded };
}

const assemblyLots = register.sources.map((lot) => {
  const ballots = assemblyBallots.filter(
    (b) => b.legislature === lot.legislature,
  );
  const named = ballots.filter((b) => b.positions.some((p) => p.vote !== null));
  const years = Object.entries(lot.scrutinsParAnnee).map(
    ([year, examined]) => ({
      year,
      ...checkedCounts(
        examined,
        named.filter((b) => b.date.startsWith(year)).length,
      ),
    }),
  );
  if (years.reduce((sum, y) => sum + y.examined, 0) !== lot.scrutinsExamines)
    throw new Error('Le détail annuel diffère de l’archive de la législature');
  return {
    id: 'assemblee-' + lot.legislature,
    institution: 'assemblee',
    term: lot.legislature,
    label: lot.legislature + 'e législature',
    from: lot.debut,
    to: lot.fin,
    source: lot.archives.scrutins.url,
    ...checkedCounts(lot.scrutinsExamines, named.length),
    byYear: years,
  };
});

const senateLots = archiveMetadata.couvertureSenat.map((lot) => {
  const session = lot.session + '-' + (Number(lot.session) + 1);
  const recorded = archiveBallots.filter(
    (b) =>
      b.institution === 'senat' &&
      b.periode === session &&
      b.positions.some((p) => p.vote !== null),
  ).length;
  return {
    id: 'senat-' + lot.session,
    institution: 'senat',
    label: 'Session ' + session,
    from: lot.debut,
    to: lot.fin,
    source: 'https://www.senat.fr/scrutin-public/scr' + lot.session + '.html',
    ...checkedCounts(lot.scrutinsExamines, recorded),
    byYear: [],
  };
});

const europeanLots = archiveMetadata.sessionsEurope.map((session) => {
  const recorded = archiveBallots.filter(
    (b) =>
      b.institution === 'parlement-europeen' &&
      b.date === session.date &&
      b.positions.some((p) => p.vote !== null),
  ).length;
  return {
    id: 'europe-' + session.date,
    institution: 'parlement-europeen',
    label: 'Séance',
    from: session.date,
    to: session.date,
    source: archiveMetadata.sources['ep-' + session.date + '.json'],
    ...checkedCounts(session.nominaux, recorded),
    byYear: [],
  };
});

const candidateByActor = new Map(
  Object.entries(register.personnes).map(([candidate, person]) => [
    person.id,
    { candidate, source: person.source },
  ]),
);
const assemblyMandates = Object.entries(register.mandats).map(([id, m]) => {
  const person = candidateByActor.get(m.acteur);
  if (!person) throw new Error('Mandat sans fiche de l’Assemblée nationale');
  const recorded = assemblyBallots.filter((b) =>
    b.positions.some((p) => p.mandat === id && p.vote !== null),
  ).length;
  return {
    id,
    institution: 'assemblee',
    term: m.legislature,
    candidate: person.candidate,
    from: m.debut,
    to: m.fin,
    source: person.source,
    ...checkedCounts(m.scrutinsExamines, recorded),
  };
});
const otherMandates = Object.entries(archiveMetadata.mandats).map(([id, m]) => {
  const recorded = archiveBallots.filter(
    (b) =>
      b.institution === m.institution &&
      b.positions.some((p) => p.mandat === id && p.vote !== null),
  ).length;
  return {
    id,
    institution: m.institution,
    term: m.legislature,
    candidate: m.candidat,
    from: m.debut,
    to: m.fin,
    source: m.source,
    ...checkedCounts(m.scrutinsExamines, recorded),
  };
});

export const parliamentaryCoverage = {
  byPeriod: [...assemblyLots, ...senateLots, ...europeanLots].sort((a, b) =>
    b.to.localeCompare(a.to),
  ),
  byMandate: [...assemblyMandates, ...otherMandates].sort((a, b) =>
    b.from.localeCompare(a.from),
  ),
};
