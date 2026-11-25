export const searchKinds: Record<string, string> = {
  breve: 'Brève de campagne',
  question: 'Question de programme',
  mesure: 'Mesure',
  candidat: 'Candidat',
  theme: 'Thème',
  dossier: 'Dossier',
  source: 'Source',
  sondage: 'Sondage',
  evenement: 'Chronologie',
  vote: 'Dossier de votes',
  evolution: 'Évolution d’une proposition',
  agenda: 'Rendez-vous de campagne',
  verification: 'Déclaration chiffrée',
  repere: 'Repère institutionnel',
  droit: 'Droit en vigueur',
  territoire: 'Données locales',
  indicateur: 'Indicateur économique',
  simulateur: 'Simulateur',
};
const icons: Record<string, string> = {
  breve: 'source',
  vote: 'vote',
  evolution: 'historique',
  agenda: 'map-pin',
  verification: 'exchange',
  sondage: 'sondages',
  evenement: 'clock',
  candidat: 'people',
  repere: 'institutions',
  droit: 'securite',
  territoire: 'map-pin',
  indicateur: 'markets',
  simulateur: 'fiscalite',
  source: 'source',
};
export function searchIcon(type: string, theme: string) {
  return type === 'mesure' ? theme : (icons[type] ?? 'layers');
}

export function searchResultLabel(entry: {
  type: string;
  year?: string;
  author?: string;
}) {
  const label =
    searchKinds[entry.type as keyof typeof searchKinds] ?? entry.type;
  return [label, entry.author, entry.year].filter(Boolean).join(' · ');
}
