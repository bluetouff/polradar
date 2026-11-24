import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editorialDayAccess,
  editorialReviewSchema,
  editorialRunsByDay,
} from '../src/lib/editorial-reviews.mjs';

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

test('les deux passages d’un jour civil gardent leur horaire, leurs incidents et leurs ajouts', () => {
  const reference = (id, ok, issues) => ({
    id,
    ok,
    url: 'https://source.example/',
    ...(issues ? { issues } : {}),
  });
  const records = [
    {
      ...review,
      checkedAt: '2026-11-19T07:06:00Z',
      hosted: {
        run: '12',
        attempt: 1,
        checks: [
          reference('source', true),
          reference('papier', false, ['article-indisponible']),
        ],
        queries: [],
        since: '2026-11-18',
        publications: [],
        changes: area.changes,
      },
    },
    {
      ...review,
      scope: 'annonces',
      checkedAt: '2026-11-19T17:05:00Z',
      hosted: {
        run: '13',
        attempt: 1,
        checks: [
          reference('source', false, ['flux-indisponible']),
          reference('meeting', true),
        ],
        queries: [],
        since: '2026-11-18',
        publications: [],
        changes: [],
      },
    },
  ];
  for (const [early, late] of [
    [records[0], records[1]],
    [
      { ...records[1], checkedAt: records[0].checkedAt },
      { ...records[0], checkedAt: records[1].checkedAt },
    ],
  ]) {
    for (const order of [
      [early, late],
      [late, early],
    ]) {
      const days = editorialRunsByDay(order);
      assert.deepEqual([...days.keys()], ['2026-11-19']);
      const day = days.get('2026-11-19');
      assert.deepEqual(day, [early, late]);
      assert.deepEqual(editorialDayAccess(day), { checked: 3, accessible: 2 });
      assert.equal(day.filter((pass) => pass.hosted.changes.length).length, 1);
      assert.deepEqual(
        day
          .flatMap((pass) =>
            pass.hosted.checks.flatMap((check) => check.issues ?? []),
          )
          .sort(),
        ['article-indisponible', 'flux-indisponible'],
      );
    }
  }
  assert.equal(editorialRunsByDay([records[0]]).get('2026-11-19').length, 1);
  assert.deepEqual(editorialDayAccess([review]), { checked: 0, accessible: 0 });
});
