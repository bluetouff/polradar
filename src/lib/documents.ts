import { dataset } from './data';
import sections from '../data/document-coverage.json';
import { buildDocumentRegister } from './document-register';

import { technicalFreshness } from './source-freshness';
export const documents = buildDocumentRegister(dataset, sections).map((d) => {
  const current = technicalFreshness.get(d.id);
  return {
    ...d,
    watch: current
      ? {
          checkedAt: current.checkedAt,
          lastSuccessAt: current.lastSuccessAt,
          status: current.status,
          fingerprint:
            d.watch?.checkedAt === current.checkedAt
              ? d.watch.fingerprint
              : null,
        }
      : null,
  };
});
const ordered = documents
  .slice()
  .sort(
    (a, b) =>
      Number(Boolean(b.coverage)) - Number(Boolean(a.coverage)) ||
      b.measureCount - a.measureCount ||
      a.id.localeCompare(b.id),
  );
export const bySource = new Map(ordered.map((d) => [d.id, d]));
const keys = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const authors = [
  ...new Set(
    documents
      .map((d) => d.author?.author)
      .filter((name): name is string => Boolean(name)),
  ),
].sort((a, b) => a.localeCompare(b, 'fr'));
if (new Set(authors.map(keys)).size !== authors.length)
  throw new Error('Deux auteurs partagent le même identifiant');
export const documentFacets = [
  ...dataset.candidates.map((c) => ({
    path: 'candidats/' + c.id,
    label: c.name,
    group: 'Candidatures',
    rows: ordered.filter((d) => d.candidates.includes(c.id)),
  })),
  ...dataset.themes.map((t) => ({
    path: 'themes/' + t.id,
    label: t.label,
    group: 'Thèmes',
    rows: ordered.filter((d) => d.themes.includes(t.id)),
  })),
  ...authors.map((author) => ({
    path: 'auteurs/' + keys(author),
    label: author,
    group: 'Auteurs vérifiés',
    rows: ordered.filter((d) => d.author?.author === author),
  })),
];
export const allDocuments = {
  path: '',
  label: 'Registre des documents',
  group: '',
  rows: ordered,
};
