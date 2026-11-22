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
  source: 'source',
};
export function searchIcon(type: string, theme: string) {
  return type === 'mesure' ? theme : (icons[type] ?? 'layers');
}
