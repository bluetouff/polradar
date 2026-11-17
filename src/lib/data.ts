import candidates from '../data/candidates.json';
import themes from '../data/themes.json';
import sources from '../data/sources.json';
import engagements from '../data/engagements.json';
import events from '../data/events.json';
import pollRows from '../data/polls.json';
import budget from '../data/budget.json';
import meta from '../data/meta.json';
import { pollSchema, validateDataset } from './schema.mjs';
const polls: ReturnType<typeof pollSchema.parse>[] = pollRows;

export const dataset = {
  candidates,
  themes,
  sources,
  engagements,
  events,
  polls,
  budget,
  meta,
};
const errors = validateDataset(dataset);
if (errors.length) throw new Error(`Corpus invalide : ${errors.join('\n')}`);
export {
  candidates,
  themes,
  sources,
  engagements,
  events,
  polls,
  budget,
  meta,
};
export type Candidate = (typeof candidates)[number];
export type Engagement = (typeof engagements)[number];
export const scopes: Record<string, string> = {
  campagne: 'Campagne 2027',
  parti: 'Projet de parti',
  orientation: 'Orientation',
  archive: 'Archive 2022',
};
export const sourceKinds: Record<string, string> = {
  campagne: 'Campagne',
  parti: 'Parti',
  institution: 'Institution publique',
  presse: 'Presse',
  archive: 'Archive',
};
export const byCandidate = (id: string, includeArchives = true) =>
  engagements.filter(
    (e) => e.candidate === id && (includeArchives || e.scope !== 'archive'),
  );
export const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .map((part) => part[0])
    .slice(0, 3)
    .join('');
export function formatDate(value: string | null) {
  if (!value) return 'Date non indiquée';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeZone: 'Europe/Paris',
  }).format(new Date(`${value}T12:00:00Z`));
}
export const candidateById = (id: string) =>
  candidates.find((c) => c.id === id)!;
export const themeById = (id: string) => themes.find((t) => t.id === id)!;
export const sourceById = (id: string) => sources.find((s) => s.id === id)!;
