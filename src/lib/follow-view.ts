export interface ChangeState {
  fields: { label: string; text: string }[];
  sources: { label: string; url: string; locator?: string }[];
}
export interface Change {
  id: string;
  day: string;
  at: string | null;
  candidate: string;
  themes: string[];
  author: string | null;
  kind: 'mesure' | 'agenda' | 'vote' | 'evolution';
  label: string;
  title: string;
  context: string;
  href: string;
  before: ChangeState | null;
  after: ChangeState | null;
}
const dateTime = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  dateStyle: 'medium',
  timeStyle: 'short',
});
const day = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  dateStyle: 'medium',
});
export const detailDate = (row: Change) =>
  row.at
    ? dateTime.format(new Date(row.at)) + ' · Paris'
    : day.format(new Date(row.day + 'T12:00:00Z')) + ' · heure non consignée';
