import candidates from '../data/candidates.json';
import themes from '../data/themes.json';
import sourceRows from '../data/sources.json';
import engagementRows from '../data/engagements.json';
import eventRows from '../data/events.json';
import pollRows from '../data/polls.json';
import budget from '../data/budget.json';
import meta from '../data/meta.json';
import measureRows from '../data/measures.json';
import versionRows from '../data/versions.json';
import watchRows from '../data/watch.json';
import {
  sourceSchema,
  eventSchema,
  measureSchema,
  versionSchema,
  watchSchema,
  pollSchema,
  engagementSchema,
  validateDataset,
  validateFeatures,
} from './schema.mjs';
const sources = sourceSchema.array().parse(sourceRows);
const events = eventSchema.array().parse(eventRows);
const engagements = engagementSchema.array().parse(engagementRows);
const polls = pollSchema.array().parse(pollRows);
const measures = measureSchema.array().parse(measureRows);
const versions = versionSchema.array().parse(versionRows);
const watch = watchSchema.array().parse(watchRows);

export const dataset = {
  candidates,
  themes,
  sources,
  engagements,
  events,
  polls,
  budget,
  meta,
  measures,
  versions,
  watch,
};
const errors = [...validateDataset(dataset), ...validateFeatures(dataset)];
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
  measures,
  versions,
  watch,
};
export type Measure = (typeof measures)[number];
export type MeasureVersion = (typeof versions)[number];
export type Poll = (typeof polls)[number];
export type Corpus = typeof dataset;
export const measureById = (id: string) =>
  measures.find((measure) => measure.id === id)!;
export const measureVersions = (id: string) =>
  versions
    .filter((version) => version.measureId === id)
    .sort((a, b) => a.number - b.number);
export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(value));
}
export const activeCandidates = candidates.filter(
  (candidate) => !candidate.withdrawnOn,
);
export type Candidate = (typeof candidates)[number];
export type Engagement = (typeof engagements)[number];
export { scopes, sourceKinds } from './labels';
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
