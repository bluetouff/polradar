import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialReviewSchema } from '../src/lib/editorial-reviews.mjs';

const schema = editorialReviewSchema([{ id: 'candidat' }], [{ id: 'source' }]);
const area = {
  id: 'agenda',
  status: 'partiel',
  note: 'Une réunion confirmée.',
  sources: ['source'],
  changes: [{ title: 'Réunion à Paris', path: '/agenda/#paris' }],
};
const review = {
  checkedAt: '2026-11-18T23:45:00Z',
  candidates: ['candidat'],
  sections: [area],
};
test('une recherche partielle peut publier un fait et laisser les autres rubriques sans contrôle', () => {
  assert.deepEqual(schema.parse([review]), [review]);
  assert.equal(
    schema.safeParse([
      { ...review, sections: [{ ...area, status: 'indisponible' }] },
    ]).success,
    false,
  );
  assert.equal(
    schema.safeParse([
      {
        ...review,
        sections: [{ ...area, status: 'indisponible', changes: [] }],
      },
    ]).success,
    true,
  );
});
test('la revue identifie les candidatures, les sources et la journée de Paris', () => {
  for (const invalid of [
    [review, { ...review, checkedAt: '2026-11-19T04:00:00Z' }],
    [{ ...review, checkedAt: 'invalide' }],
    [{ ...review, checkedAt: '2999-01-01T00:00:00Z' }],
    [{ ...review, candidates: ['inconnu'] }],
    [{ ...review, candidates: ['candidat', 'candidat'] }],
    [{ ...review, sections: [area, area] }],
    [{ ...review, sections: [{ ...area, sources: ['absente'] }] }],
    [{ ...review, sections: [{ ...area, sources: [] }] }],
  ])
    assert.equal(schema.safeParse(invalid).success, false);
  assert.equal(
    schema.safeParse([review, { ...review, checkedAt: '2026-11-19T23:01:00Z' }])
      .success,
    true,
  );
});
test('les liens vers les nouveautés sont des pages locales', () => {
  for (const path of [
    'https://example.org/',
    '//example.org/',
    '/a/../',
    '/%2fexample.org/',
    '/a\\b/',
    'javascript:void(0)',
  ])
    assert.equal(
      schema.safeParse([
        {
          ...review,
          sections: [{ ...area, changes: [{ title: 'Lien', path }] }],
        },
      ]).success,
      false,
    );
});
