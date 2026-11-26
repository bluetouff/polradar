import assert from 'node:assert/strict';
import test from 'node:test';
import {
  corpusCounts,
  corpusActivity,
  identicalProposals,
  latestRecordedVersion,
} from '../src/lib/corpus-counts.mjs';
import { sourceRefSchema } from '../src/lib/schema.mjs';

test('les proportions comptent les fiches une fois et séparent parti, campagne, orientation et archive', () => {
  const candidates = [
    { id: 'b', name: 'B' },
    { id: 'a', name: 'A', withdrawnOn: '2026-11-21' },
    { id: 'c', name: 'C' },
  ];
  const themes = [
    { id: 'justice', label: 'Justice' },
    { id: 'ecole', label: 'École' },
  ];
  const measures = ['campagne', 'parti', 'orientation', 'archive'].map(
    (scope, i) => ({
      id: String(i),
      scope,
      revision: i + 1,
      candidate: i === 3 ? 'a' : 'b',
      theme: i % 2 ? 'justice' : 'ecole',
    }),
  );
  const c = corpusCounts({ measures, candidates, themes });
  assert.equal(c.proposals, 2);
  assert.equal(c.current, 3);
  assert.equal(c.total, 4);
  assert.deepEqual(
    c.candidates.map((x) => x.id),
    ['a', 'b', 'c'],
  );
  assert.equal(c.candidates[0].counts.archive, 1);
  assert.equal(c.candidates[2].counts.campagne, 0);
  assert.equal(c.themes[0].counts.parti, 1);
  assert.equal(c.themes[1].counts.orientation, 1);
  assert.equal(corpusCounts({ measures: [], candidates, themes }).total, 0);
});

test('les renvois vers une page de PDF ou une proposition numérotée restent des fragments de la source', () => {
  const ref = { sourceId: 'programme', locator: 'Chapitre 2' };
  for (const fragment of [
    undefined,
    'page=1',
    'proposition-255',
    ':~:text=Chapitre%20consacr%C3%A9',
  ]) {
    assert.ok(sourceRefSchema.safeParse({ ...ref, fragment }).success);
  }
  for (const fragment of [
    ':~:text=',
    ':~:text=Chapitre%2',
    ':~:text=' + 'a'.repeat(501),
    'page=0',
    'page=10000',
    'https://example.com',
    'proposition-2&search=x',
  ]) {
    assert.equal(
      sourceRefSchema.safeParse({ ...ref, fragment }).success,
      false,
    );
  }
});

test('le graphique quotidien suit les enregistrements datés en heure de Paris', () => {
  const rows = [
    { number: 1, observedOn: '2024-02-16', recordedAt: '2024-02-16T21:00:00Z' },
    { number: 1, observedOn: '2024-02-17', recordedAt: '2024-02-16T23:30:00Z' },
    { number: 2, observedOn: '2024-02-29', recordedAt: '2024-02-29T19:00:00Z' },
    { number: 3, observedOn: '2024-02-29', recordedAt: '2024-02-29T20:00:00Z' },
    { number: 1, observedOn: '2024-02-18', recordedAt: '2024-02-29T23:30:00Z' },
    { number: 1, observedOn: '2024-03-02', recordedAt: '2024-03-01T23:30:00Z' },
    { number: 1, observedOn: '2024-02-25', recordedAt: null },
  ];
  const series = corpusActivity(rows, '2024-03-01');
  assert.equal(series.length, 14);
  assert.deepEqual(series[0], { date: '2024-02-17', added: 1, revised: 0 });
  assert.equal(series[1].added + series[1].revised, 0);
  assert.deepEqual(series[8], { date: '2024-02-25', added: 0, revised: 0 });
  assert.deepEqual(series.at(-2), { date: '2024-02-29', added: 0, revised: 2 });
  assert.deepEqual(series.at(-1), { date: '2024-03-01', added: 1, revised: 0 });
});

test('le dernier enregistrement compare les instants indépendamment de leur décalage horaire', () => {
  const older = { id: 'premiere', recordedAt: '2026-11-25T19:40:00+02:00' };
  const latest = { id: 'seconde', recordedAt: '2026-11-25T18:10:00Z' };
  const unknown = { id: 'ancienne', recordedAt: null };
  assert.equal(latestRecordedVersion([latest, unknown, older]), latest);
  assert.equal(latestRecordedVersion([unknown]), null);
  assert.equal(latestRecordedVersion([]), null);
});

test('les rapprochements textuels gardent les conditions et les auteurs distincts', () => {
  const m = {
    id: 'premiere-fiche',
    candidate: 'a',
    scope: 'campagne',
    title: 'Titre de proposition',
    description: 'Documenter un dispositif.',
    beneficiaries: null,
    timing: null,
    financing: null,
    metrics: [],
    amounts: [],
  };
  assert.deepEqual(
    identicalProposals([
      m,
      {
        ...m,
        id: 'seconde-fiche',
        title: 'Titre de  proposition',
        edition: 'Autre document',
      },
      { ...m, id: 'condition', timing: 'Pendant deux ans' },
      { ...m, id: 'autre-candidat', candidate: 'b' },
      { ...m, id: 'collectif-1', scope: 'parti', partyAuthor: 'Collectif A' },
      { ...m, id: 'collectif-2', scope: 'parti', partyAuthor: 'Collectif B' },
      { ...m, id: 'archive', scope: 'archive' },
    ]),
    [['premiere-fiche', 'seconde-fiche']],
  );
});
