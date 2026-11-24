import { readFileSync } from 'node:fs';

export interface SenateDocument {
  id: string;
  categorie: 'proposition-de-loi' | 'autre-texte' | 'rapport';
  nature: string;
  titre: string;
  dateDepot: string;
  session: string;
  numero: string;
  source: string;
  signatures: { personne: string; candidat: string; role: string }[];
}
interface Register {
  consultation: string;
  documents: SenateDocument[];
  personnes: Record<string, { nom: string; candidat: string; source: string }>;
  signaturesSansDocument: unknown[];
  licenceSource: string;
}
export const senateRegister: Register = JSON.parse(
  readFileSync('src/data/parlement/textes-senat.json', 'utf8'),
);
const { documents, personnes } = senateRegister;
const categories = [
  {
    id: 'propositions-de-loi',
    code: 'proposition-de-loi',
    title: 'Propositions de loi',
  },
  {
    id: 'autres-textes',
    code: 'autre-texte',
    title: 'Résolutions, motions et autres textes',
  },
  { id: 'rapports', code: 'rapport', title: 'Rapports et avis' },
];
export const senateGroups = [
  ...categories.map((c) => ({
    id: c.id,
    title: c.title,
    type: 'document',
    rows: documents.filter((d) => d.categorie === c.code),
  })),
  ...Object.values(personnes)
    .sort((a, b) => a.candidat.localeCompare(b.candidat, 'fr'))
    .map((p) => ({
      id: p.candidat,
      title: p.nom,
      type: 'personne',
      rows: documents.filter((d) =>
        d.signatures.some((s) => s.candidat === p.candidat),
      ),
    })),
];
