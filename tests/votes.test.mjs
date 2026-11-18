import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  legislativeVotesSchema,
  validateLegislativeReferences,
  positionLabel,
  ballotDots,
} from '../src/lib/legislative-votes.mjs';
import { immutableHistoryErrors } from '../src/lib/history.mjs';
const read = (n) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${n}.json`, import.meta.url), 'utf8'),
  );
const data = legislativeVotesSchema.parse(read('legislative-votes'));
const dataset = Object.fromEntries(
  ['candidates', 'measures', 'versions'].map((n) => [n, read(n)]),
);
const valid = (d = data) =>
  validateLegislativeReferences(d, dataset, new Date('2026-11-19T12:00:00Z'));
test('six dossiers lient des propositions figées à six scrutins nominatifs institutionnels', () => {
  assert.deepEqual(valid(), []);
  assert.equal(data.ballots.length, 6);
  assert.equal(data.cases.length, 6);
  for (const c of data.cases)
    assert.ok(dataset.versions.some((v) => v.id === c.versionId));
});
test('une motion garde son objet : contre le rejet ne devient pas contre l’ISF', () => {
  const b = data.ballots.find((b) => b.id === 'an15-1716');
  assert.equal(positionLabel(b.positions[0], b), 'Contre la motion');
  assert.equal(b.decision, 'adopte');
  assert.equal(
    positionLabel(data.ballots[2].positions[0], data.ballots[2]),
    'Contre l’article',
  );
});
test('la censure ne fabrique ni contre ni abstention pour les députés non recensés', () => {
  const b = data.ballots.find((b) => b.kind === 'motion-censure');
  assert.equal(b.tally.for, 278);
  assert.equal(b.tally.majority, 287);
  assert.equal(b.decision, 'rejete');
  assert.equal(b.tally.against, null);
  assert.equal(b.tally.abstained, null);
  assert.equal(ballotDots(b).dots.length, 278);
  assert.equal(positionLabel(b.positions[0], b), 'Pour la motion');
  for (const key of ['against', 'abstained']) {
    const d = structuredClone(data);
    d.ballots.at(-1).tally[key] = 0;
    assert.ok(valid(d).length);
  }
});
test('les points rendent exactement les voix, sans débordement ni ajout de non-votants', () => {
  for (const b of data.ballots) {
    const c = ballotDots(b);
    assert.equal(c.dots.length, b.tally.voters);
    for (const d of c.dots) {
      assert.ok(d.x >= 3 && d.x + 3 <= c.width);
      assert.ok(d.y >= 3 && d.y + 3 <= c.height);
    }
    for (const [choice, key] of [
      ['pour', 'for'],
      ['contre', 'against'],
      ['abstention', 'abstained'],
    ])
      assert.equal(
        c.dots.filter((d) => d.choice === choice).length,
        b.tally[key] ?? 0,
      );
  }
});
test('un homonyme, un profil au préfixe trompeur et les incohérences de source ou de portée sont refusés', () => {
  const changes = [
    (d) => (d.ballots[0].positions[0].officialName = 'Philippe Édouard'),
    (d) => {
      d.ballots.at(-1).positions[0].officialName = 'Cédric Roussel';
    },
    (d) => {
      d.ballots[1].positions[0].profileUrl += '0';
    },
    (d) => {
      d.ballots[1].positions[0].officialId = null;
    },
    (d) => {
      d.ballots[1].positions[0].candidate = 'inconnu';
    },
    (d) => (d.ballots[0].source.url = 'https://example.org/scrutin'),
    (d) => (d.ballots[0].documents[0].url = 'https://example.org/texte'),
    (d) => d.ballots[0].tally.for++,
    (d) => (d.ballots[0].decision = 'rejete'),
    (d) => (d.ballots[0].source.checkedAt = '2027-01-01T00:00:00Z'),
    (d) => (d.ballots[0].date = '2027-01-02'),
    (d) => (d.cases[0].versionId = 'attal-travail-2-v1'),
    (d) => (d.cases[0].links[1].relation = 'meme-objet'),
    (d) => (d.cases[0].links[0].ballotId = 'an15-49'),
    (d) => d.ballots.push(d.ballots[0]),
    (d) => d.cases.push(d.cases[0]),
  ];
  for (const change of changes) {
    const d = structuredClone(data);
    change(d);
    assert.ok(valid(d).length, String(change));
  }
});
test('dates invalides, comptes négatifs et URL privées ne franchissent pas le schéma', () => {
  for (const mutate of [
    (d) => (d.ballots[0].date = '2023-02-30'),
    (d) => (d.ballots[0].tally.for = -1),
    (d) => (d.ballots[0].source.url = 'http://localhost/secret'),
    (d) => (d.ballots[0].positions[0].officialId = '../../secret'),
  ]) {
    const d = structuredClone(data);
    mutate(d);
    assert.equal(legislativeVotesSchema.safeParse(d).success, false);
  }
});
test('une capture de scrutin déjà intégrée reste immuable', () => {
  const copy = structuredClone(data.ballots);
  copy[0].positions[0].choice = 'pour';
  assert.ok(immutableHistoryErrors(data.ballots, copy).length);
  assert.ok(immutableHistoryErrors(data.ballots, data.ballots.slice(1)).length);
});
