import { readFileSync } from 'node:fs';
import { candidateById } from './data';

export interface ParliamentaryPosition {
  candidat: string;
  mandat: string;
  vote: string | null;
  groupe: string | null;
  delegation: boolean | null;
  misesAuPoint: { vote: string; nature: string }[];
}
export interface ParliamentaryBallot {
  id: string;
  legislature: number;
  numero: number;
  date: string;
  objet: string;
  type: string;
  decision: string;
  censure: boolean;
  totaux: {
    votants: number;
    exprimes: number;
    majorite: number;
    pour: number;
    contre: number | null;
    abstention: number | null;
  };
  source: string;
  positions: ParliamentaryPosition[];
}
interface Register {
  version: number;
  institution: string;
  licenceSource: string;
  consultation: string;
  sources: {
    legislature: number;
    scrutinsExamines: number;
    congresExclus: number;
    archives: Record<string, { url: string; sha256: string }>;
  }[];
  personnes: Record<string, { id: string; source: string }>;
  mandats: Record<
    string,
    { acteur: string; debut: string; fin: string | null }
  >;
  groupes: Record<string, { nom: string; sigle: string }>;
  scrutins: ParliamentaryBallot[];
}
export const register: Register = JSON.parse(
  readFileSync('src/data/parlement/assemblee.json', 'utf8'),
);
export const ballotsByMonth = new Map<string, ParliamentaryBallot[]>();
for (const b of register.scrutins) {
  const month = b.date.slice(0, 7);
  if (!ballotsByMonth.has(month)) ballotsByMonth.set(month, []);
  ballotsByMonth.get(month)!.push(b);
}
const { scrutins, ...description } = register;
export const registerIndex = {
  ...description,
  personnes: Object.fromEntries(
    Object.entries(register.personnes).map(([id, p]) => [
      id,
      {
        ...p,
        nom: candidateById(id).name,
        fiches: register.scrutins.filter((b) =>
          b.positions.some((pos) => pos.candidat === id),
        ).length,
      },
    ]),
  ),
  scrutins: scrutins.length,
  positions: scrutins.reduce(
    (n, b) => n + b.positions.filter((p) => p.vote !== null).length,
    0,
  ),
  misesAuPoint: scrutins.reduce(
    (n, b) => n + b.positions.reduce((s, p) => s + p.misesAuPoint.length, 0),
    0,
  ),
  lots: Array.from(ballotsByMonth, ([mois, rows]) => ({
    mois,
    nombre: rows.length,
    url: `https://polradar.fr/api/parlement/${mois}.json`,
  })),
};
export function registerMonth(month: string) {
  return {
    version: register.version,
    mois: month,
    index: 'https://polradar.fr/api/parlement/index.json',
    scrutins: ballotsByMonth.get(month)!,
  };
}
