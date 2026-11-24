export const chamberLabels: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
  'parlement-europeen': 'Parlement européen',
};
export const kindLabels: Record<string, string> = {
  vote: 'Scrutin',
  depot: 'Texte déposé',
  rapport: 'Rapport ou avis',
  intervention: 'Intervention',
  cosignature: 'Co-signature',
  'mise-au-point': 'Mise au point ou intention',
};
export const mentionLabels: Record<string, string> = {
  pour: 'Pour',
  contre: 'Contre',
  abstention: 'Abstention',
  'non-votant': 'Non-votant',
  'non-votant-volontaire': 'Non-votant volontaire',
  'primo-signataire': 'Premier signataire',
  coauteur: 'Coauteur',
  signataire: 'Signataire',
  président: 'Président',
  intervention: 'Intervention',
};
export type Mention = [
  person: string,
  choiceOrRole: string,
  kind: 'vote' | 'note' | 'signature',
];
export interface AssemblyDetail {
  decision: string;
  type: string;
  totaux: {
    votants: number;
    exprimes: number;
    majorite: number;
    pour: number;
    contre: number | null;
    abstention: number | null;
  };
  positions: {
    candidat: string;
    mandat: string;
    vote: string | null;
    groupe: string | null;
    delegation: boolean | null;
    misesAuPoint: { vote: string; nature: string }[];
  }[];
}
export interface ParliamentaryAct {
  id: string;
  date: string;
  institution: string;
  nature: string;
  titre: string;
  source: string;
  releve?: AssemblyDetail;
  mentions: Mention[];
  themes?: string[];
  intitule?: string;
  intervenant?: string;
  dossier?: string;
}
export interface ActIndex {
  version: number;
  empreinte: string;
  candidats: Record<string, string>;
  themes: Record<string, string>;
  assembleeXVII: {
    scrutinsExamines: number;
    scrutinsAvecMention: number;
    source: string;
    personnes: Record<string, { id: string; source: string }>;
    mandats: Record<
      string,
      { acteur: string; debut: string; fin: string | null }
    >;
    groupes: Record<string, { nom: string; sigle: string }>;
  };
  seancesEurope: string[];
  sessionsSenat: string[];
  actes: ParliamentaryAct[];
}
export interface ActFilters {
  query?: string;
  candidat?: string;
  institution?: string;
  debut?: string;
  fin?: string;
  position?: string;
  nature?: string;
  theme?: string;
}
export const pageSize = 15;
export const foldAct = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/œ/gu, 'oe')
    .replace(/æ/gu, 'ae')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
export function findAct(row: ParliamentaryAct, f: ActFilters, terms: string[]) {
  if (
    (f.institution && row.institution !== f.institution) ||
    (f.debut && row.date < f.debut) ||
    (f.fin && row.date > f.fin) ||
    (f.theme && !row.themes?.includes(f.theme))
  )
    return false;
  if (
    f.nature &&
    !['cosignature', 'mise-au-point'].includes(f.nature) &&
    row.nature !== f.nature
  )
    return false;
  if (
    (f.candidat ||
      f.position ||
      ['cosignature', 'mise-au-point'].includes(f.nature ?? '')) &&
    !row.mentions.some(
      ([p, choice, kind]) =>
        (!f.candidat || p === f.candidat) &&
        (!f.position || (kind === 'vote' && choice === f.position)) &&
        (f.nature !== 'cosignature' ||
          (kind === 'signature' && choice === 'coauteur')) &&
        (f.nature !== 'mise-au-point' || kind === 'note'),
    )
  )
    return false;
  if (!terms.length) return true;
  const text = foldAct(
    [row.titre, row.intitule, row.intervenant, row.id]
      .filter(Boolean)
      .join(' '),
  );
  return terms.every((term) => text.includes(term));
}
export function coverage(
  index: Pick<ActIndex, 'seancesEurope' | 'sessionsSenat'>,
  f: ActFilters,
) {
  if (f.debut && f.debut === f.fin && f.institution === 'parlement-europeen') {
    if (index.seancesEurope.includes(f.debut)) return 'seance-examinee';
    if (['2017-02-15', '2018-05-29'].includes(f.debut)) return 'scrutin-isole';
    return 'periode-hors-registre';
  }
  if (
    f.institution === 'senat' &&
    f.nature === 'vote' &&
    f.debut &&
    f.debut === f.fin
  ) {
    const year =
      Number(f.debut.slice(0, 4)) - (f.debut.slice(5, 10) < '10-01' ? 1 : 0);
    return index.sessionsSenat.includes(String(year))
      ? 'session-examinee'
      : 'periode-hors-registre';
  }
  return 'couverture-partielle';
}
export const coverageLabels: Record<string, string> = {
  'seance-examinee':
    'La séance européenne a été examinée. Les listes nominatives consultées ne donnent aucune mention correspondant à ces critères.',
  'session-examinee':
    'La session du Sénat a été examinée. Aucun scrutin correspondant aux critères dans ce registre.',
  'scrutin-isole': 'Seul un scrutin de cette séance européenne est documenté.',
  'periode-hors-registre':
    'Cette période se situe hors des séances examinées pour ce registre.',
  'couverture-partielle':
    'La couverture varie selon les mandats, les institutions et les dates. Une mention manquante ne renseigne pas la présence en séance.',
};
