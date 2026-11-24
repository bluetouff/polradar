const labels: Record<string, string> = {
  pour: 'Pour',
  contre: 'Contre',
  abstention: 'Abstention',
  'non-votant': 'Non-votant',
  'non-votant-volontaire': 'Non-votant volontaire',
};
export const choiceLabel = (choice: string | null) =>
  choice === null ? 'Vote non renseigné' : (labels[choice] ?? choice);

const terms: Record<number, string> = { 15: 'XVe', 16: 'XVIe', 17: 'XVIIe' };
export const termLabel = (term: number) => terms[term] ?? String(term);
