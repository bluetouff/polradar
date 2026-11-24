import { readFileSync } from 'node:fs';
import { formatDate } from './data';

interface Position {
  candidat: string;
  personne: string;
  vote: string | null;
  mandat: string;
  groupe: string | null;
  intentions: string[];
}
export interface ArchiveBallot {
  id: string;
  institution: 'senat' | 'parlement-europeen';
  periode: string;
  date: string;
  numero: string;
  objet: string;
  decision: string | null;
  pour: number;
  contre: number;
  abstentions: number;
  positions: Position[];
  misesAuPoint: { notice: string; source: string | null }[];
  textes?: string[];
  source: string;
}
interface Archive {
  version: number;
  consultation: string;
  droitsSources: Record<
    string,
    { producteur: string; licence: string; miseAJour?: string }
  >;
  sources: Record<string, string>;
  sessionsSenat: string[];
  sessionsEurope: { date: string; decisions: number; nominaux: number }[];
  personnes: Record<string, { candidat: string; nom: string; source: string }>;
  scrutins: ArchiveBallot[];
}
const data: Archive = JSON.parse(
  readFileSync('src/data/parlement/senat-europe.json', 'utf8'),
);
export const { scrutins: archiveBallots, ...archiveMetadata } = data;
export const archiveGroups = [
  ...data.sessionsSenat.map((y) => ({
    id: 'senat-' + y,
    label: 'Session ' + y + '–' + (Number(y) + 1),
    institution: 'Sénat',
    source: 'https://www.senat.fr/scrutin-public/scr' + y + '.html',
    rows: archiveBallots.filter(
      (b) => b.institution === 'senat' && b.periode.startsWith(y + '-'),
    ),
  })),
  ...data.sessionsEurope.map((d) => ({
    id: 'europe-' + d.date,
    label: formatDate(d.date),
    institution: 'Parlement européen',
    source: data.sources['ep-' + d.date + '.json'],
    rows: archiveBallots.filter(
      (b) => b.institution === 'parlement-europeen' && b.date === d.date,
    ),
  })),
].sort((a, b) => b.id.localeCompare(a.id));
export const archiveIndex = {
  ...archiveMetadata,
  total: archiveBallots.length,
  lots: archiveGroups.map((g) => ({
    id: g.id,
    titre: g.label,
    institution: g.institution,
    nombre: g.rows.length,
    mentions: g.rows.reduce((a, b) => a + b.positions.length, 0),
    source: g.source,
    url: 'https://polradar.fr/api/parlement/archives/' + g.id + '.json',
  })),
};
