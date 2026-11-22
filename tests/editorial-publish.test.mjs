import test from 'node:test';
import assert from 'node:assert/strict';
import { integrate } from '../scripts/publish-editorial.mjs';
import { editorialSections } from '../src/lib/editorial-reviews.mjs';
const keys = Object.keys(editorialSections);
const day = '2026-11-21',
  at = day + 'T18:00:00.000Z',
  now = Date.parse(at) + 1000;
const config = {
  candidates: { test: ['source'] },
  sections: Object.fromEntries(keys.map((k) => [k, { sources: ['source'] }])),
  programmes: { source: 'theme' },
};
function data() {
  return {
    candidates: [{ id: 'test', name: 'Exemple Nom' }],
    sources: [
      {
        id: 'source',
        url: 'https://campagne.example/programme/',
        kind: 'campagne',
        title: 'Programme',
      },
    ],
    events: [],
    engagements: [
      {
        id: 'theme',
        sources: ['source'],
        scope: 'campagne',
        theme: 'sante',
        candidate: 'test',
        edition: '2027',
      },
    ],
    measures: [],
    versions: [],
    agenda: { checked: day, cities: [], events: [] },
    daily: [],
    reviews: [],
  };
}
function report() {
  return {
    checkedAt: at,
    since: '2026-11-20',
    queries: ['test', ...keys].map((id) => ({
      id,
      count: 0,
      engine: 'google',
      leads: [],
    })),
    checks: [
      {
        source: 'source',
        url: 'https://campagne.example/programme/',
        ok: true,
        proposals: [{ number: 3, title: 'Étendre les horaires des centres' }],
        publications: [
          {
            url: 'https://campagne.example/meeting',
            date: day,
            title: 'Meeting de campagne',
            candidates: ['test'],
            event: {
              start: '2026-12-06T13:30:00Z',
              status: 'EventScheduled',
              city: 'Avion',
              venue: 'Salle Jorion',
              performer: 'Exemple Nom',
            },
          },
        ],
      },
    ],
  };
}
test('la reprise conserve les ajouts, les versions et la revue signée du jour', () => {
  const db = data(),
    r = report();
  db.reviews.push({
    checkedAt: day + 'T15:00:00Z',
    candidates: ['test'],
    sections: [
      {
        id: 'agenda',
        status: 'consulte',
        note: 'Revue existante.',
        sources: ['source'],
        changes: [],
      },
    ],
  });
  integrate(r, db, '1234', 1, now, config);
  assert.equal(db.agenda.events[0].time, '14:30');
  assert.equal(db.events[0].dateKind, 'publication');
  assert.equal(db.versions[0].kind, 'import');
  assert.equal(db.reviews[0].manualCheckedAt, day + 'T15:00:00Z');
  assert.equal(db.reviews[0].sections[0].note, 'Revue existante.');
  const once = structuredClone(db);
  integrate(r, db, '1234', 1, now, config);
  assert.deepEqual(db, once);
  r.checks[0].proposals[0].title = 'Étendre les horaires de nuit';
  r.checks[0].publications[0].event.status = 'EventCancelled';
  integrate(r, db, '1234', 2, now, config);
  assert.equal(db.measures.length, 1);
  assert.equal(db.versions.length, 2);
  assert.deepEqual(db.versions[0], once.versions[0]);
  assert.equal(db.agenda.events[0].status, 'annule');
  assert.equal(db.events.length, 1);
  assert.equal(db.reviews.length, 1);
});
test('une panne reste visible et ne publie aucun fait de campagne', () => {
  const db = data(),
    r = report();
  r.queries.forEach((q) => Object.assign(q, { count: null, engine: null }));
  Object.assign(r.checks[0], { ok: false, proposals: [], publications: [] });
  integrate(r, db, '1234', 1, now, config);
  assert.equal(db.reviews[0].candidates.length, 0);
  assert.ok(db.reviews[0].sections.every((s) => s.status === 'indisponible'));
  assert.equal(db.events.length, 0);
});
test('une invitation relative sans date de réunion reste dans le journal des sources', () => {
  const db = data(),
    r = report();
  Object.assign(r.checks[0].publications[0], {
    title: 'Ce samedi, rendez-vous au meeting',
    event: null,
  });
  integrate(r, db, '1234', 1, now, config);
  assert.equal(db.reviews[0].hosted.publications.length, 1);
  assert.equal(db.events.length, 0);
  assert.equal(db.agenda.events.length, 0);
});
test('une annulation explicite reste suivie après la fenêtre de recherche initiale', () => {
  const db = data(),
    r = report();
  integrate(r, db, '1234', 1, now, config);
  const later = structuredClone(r);
  later.checkedAt = '2026-11-22T09:00:00.000Z';
  later.since = '2026-11-22';
  later.checks[0].publications[0].event.status = 'EventCancelled';
  integrate(later, db, '1240', 1, Date.parse(later.checkedAt) + 1000, config);
  assert.equal(db.agenda.events[0].status, 'annule');
  assert.equal(db.events.length, 1);
  assert.equal(db.reviews[0].hosted.changes.length, 1);
  assert.throws(() =>
    integrate(
      later,
      data(),
      '1240',
      1,
      Date.parse(later.checkedAt) + 1000,
      config,
    ),
  );
});
test('les documents étrangers, les attributions incohérentes et les retours périmés sont rejetés', () => {
  for (const edit of [
    (r) =>
      (r.checks[0].publications[0].url = 'https://ailleurs.example/meeting'),
    (r) => (r.checks[0].publications[0].candidates = ['autre']),
    (r) => (r.checks[0].publications[0].date = '2026-11-25'),
    (r) => (r.checks[0].url = 'https://campagne.example/autre'),
    (r) => r.queries.pop(),
    (r) => (r.checkedAt = '2026-11-15T18:00:00Z'),
    (r) => (r.checks[0].publications[0].title = '<em>Titre</em>'),
  ]) {
    const r = report();
    edit(r);
    assert.throws(() => integrate(r, data(), '1234', 1, now, config));
  }
  const r = report();
  r.checks[0].publications[0].event.performer = 'Une autre personne';
  const db = data();
  integrate(r, db, '1234', 1, now, config);
  assert.equal(db.agenda.events.length, 0);
});
