import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  dateSchema,
  publicUrlSchema,
  validateDataset,
} from '../src/lib/schema.mjs';
const names = [
  'candidates',
  'themes',
  'sources',
  'engagements',
  'events',
  'polls',
  'budget',
  'meta',
];
const original = Object.fromEntries(
  names.map((name) => [
    name,
    JSON.parse(
      readFileSync(
        new URL(`../src/data/${name}.json`, import.meta.url),
        'utf8',
      ),
    ),
  ]),
);
const changed = (fn) => {
  const copy = structuredClone(original);
  fn(copy);
  return validateDataset(copy);
};

test('le corpus livré passe les contrôles', () =>
  assert.deepEqual(validateDataset(original), []));
test('une archive collective conserve son auteur et exige une source de parti', () => {
  const archive = original.engagements.find(
    (row) => row.scope === 'archive' && row.partyAuthor,
  );
  assert.ok(archive);
  assert.ok(
    original.sources.some(
      (s) => s.kind === 'parti' && archive.sources.includes(s.id),
    ),
  );
  const errors = changed((d) => {
    const row = d.engagements.find((item) => item.id === archive.id);
    row.sources = [d.sources.find((s) => s.kind === 'institution').id];
  });
  assert.ok(
    errors.includes(archive.id + ': auteur collectif sans document de parti'),
  );
});
test('les anciennes références et le périmètre de veille sont validés', () => {
  assert.deepEqual(
    changed((d) => {
      d.sources[0].previousUrl = 'https://example.org/document';
      d.sources[0].watchContentClass = 'ob-sections';
    }),
    [],
  );
  assert.ok(
    changed((d) => {
      d.sources[0].previousUrl = 'javascript:alert(1)';
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.sources[0].watchContentClass = 'x]script';
    }).length,
  );
});
test('les dates civiles impossibles sont refusées', () => {
  for (const value of ['2025-02-29', '2026-13-01', '2026-11-31', 'demain'])
    assert.equal(dateSchema.safeParse(value).success, false);
  assert.equal(dateSchema.safeParse('2024-02-29').success, true);
});
test('les URL actives, locales et authentifiées sont refusées', () => {
  for (const value of [
    'javascript:alert(1)',
    'http://example.org/',
    'https://user:secret@example.org/',
    'https://127.0.0.1/',
    'https://app.local/',
    'https://localhost./',
    'https://app.internal./',
    'https://example.org/\nheader',
    'https://example.org\\@localhost/',
    'https://[::1]/',
    'https://example.org:8443/',
  ])
    assert.equal(publicUrlSchema.safeParse(value).success, false);
  assert.equal(
    publicUrlSchema.safeParse('https://www.insee.fr/fr/statistiques').success,
    true,
  );
});
test('une référence cassée et un doublon bloquent la publication', () => {
  assert.ok(changed((d) => d.engagements[0].sources.push('inconnue')).length);
  assert.ok(changed((d) => d.candidates.push(d.candidates[0])).length);
});
test('une archive ne perd pas son millésime', () => {
  assert.ok(
    changed((d) => {
      const item = d.engagements.find((e) => e.scope === 'archive');
      item.edition = 'Campagne actuelle';
    }).length,
  );
});
test('les unités et la cohérence des comptes sont contrôlées', () => {
  assert.ok(
    changed((d) => {
      d.budget.unit = 'milliards';
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.budget.values.revenue = 2;
    }).length,
  );
});
test('la série Insee conserve un exercice par an et le solde publié pour chaque exercice', () => {
  assert.ok(
    changed((d) => {
      d.budget.history[1].year = d.budget.history[0].year;
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.budget.history.at(-1).values.deficit = 0;
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.budget.history[0].status = 'estimé';
    }).length,
  );
});
test('les mises à jour conservent des dates et des exercices annuels cohérents', () => {
  assert.ok(
    changed((d) => {
      d.meta.corpusUpdated = '2099-01-01';
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.budget.year = new Date().getUTCFullYear();
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.budget.published = '2026-02-31';
    }).length,
  );
});
test('une enquête incohérente est refusée', () => {
  assert.ok(
    changed((d) =>
      d.polls.push({
        id: 'test',
        institute: 'Institut',
        commissioner: 'Commanditaire',
        published: '2026-11-01',
        fieldworkStart: '2026-11-02',
        fieldworkEnd: '2026-11-03',
        sampleSize: 1000,
        usefulSample: 2000,
        scenario: 'Scénario',
        noticeSource: 'sondages',
        results: [
          { name: 'A', percentage: 70 },
          { name: 'B', percentage: 50 },
        ],
        uncertainty: 'À documenter',
      }),
    ).length,
  );
});

test('les mises à jour documentaires restent distinctes de la publication', () => {
  assert.ok(
    changed((d) => {
      d.sources[0].updated = '2099-01-01';
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.sources[0].published = '2026-11-16';
      d.sources[0].updated = '2026-11-15';
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.sources[0].watch = 'false';
    }).length,
  );
});

test('la chronologie distingue les dates et refuse les candidats inconnus ou les événements futurs', () => {
  assert.ok(
    changed((d) => {
      d.events[0].dateKind = 'date-devinee';
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.events[0].candidates = ['inconnu'];
    }).length,
  );
  assert.ok(
    changed((d) => {
      d.events[0].date = '2099-01-01';
    }).length,
  );
});

test('le suivi vidéo impose une URL YouTube canonique', () => {
  assert.deepEqual(
    changed((d) => {
      d.sources[0].url = 'https://www.youtube.com/watch?v=8p5_pfTtcck';
      d.sources[0].watchFormat = 'youtube-oembed';
    }),
    [],
  );
  for (const url of [
    'https://example.org/watch?v=8p5_pfTtcck',
    'https://www.youtube.com/watch?v=8p5_pfTtcck&v=abcdefghijk',
    'https://www.youtube.com/watch?v=8p5_pfTtcck#x',
  ]) {
    assert.ok(
      changed((d) => {
        d.sources[0].url = url;
        d.sources[0].watchFormat = 'youtube-oembed';
      }).length,
    );
  }
});

test('un dossier de parti et une déclaration personnelle peuvent partager un thème, deux dossiers du même auteur restent un doublon', () => {
  const errors = changed((d) => {
    const current = d.engagements.find(
      (e) => e.id === 'rohou-climat-presidentielle',
    );
    d.engagements.push({ ...current, id: 'rohou-test-duplique' });
  });
  assert.ok(errors.some((e) => e.includes('doublon candidat/thème')));
});
test('une année seule reste distincte du jour de publication et doit précéder la consultation', () => {
  assert.ok(
    changed((d) => {
      d.sources[0].publishedYear = '2099';
    }).some((e) => e.includes('année de publication')),
  );
  assert.ok(
    changed((d) => {
      d.sources[0].published = '2023-02-01';
      d.sources[0].publishedYear = '2022';
    }).some((e) => e.includes('année de publication')),
  );
});
