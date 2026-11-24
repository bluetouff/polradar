import snapshot from '../data/poll-catalogue.json';
import audits from '../data/poll-notice-audits.json';
import { polls, sources } from './data';
import {
  catalogueSchema,
  catalogueCoverage,
  coverageLabels,
} from './poll-catalogue.mjs';

export const catalogue = catalogueSchema.parse(snapshot);
export const noticeRows = catalogueCoverage(
  catalogue,
  polls,
  sources,
  audits,
).sort(
  (a, b) =>
    (b.listedMonth ?? '').localeCompare(a.listedMonth ?? '') ||
    (b.number ?? '').localeCompare(a.number ?? '', 'fr', { numeric: true }) ||
    Number(b.downloadId) - Number(a.downloadId),
);
export const noticeViews = [
  { path: '', label: 'Toutes les notices', rows: noticeRows },
  ...Object.entries(coverageLabels).map(([key, label]) => ({
    path: key.replaceAll('_', '-'),
    label,
    rows: noticeRows.filter((r) => r.status === key),
  })),
];
