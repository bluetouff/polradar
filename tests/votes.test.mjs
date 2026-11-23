import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  legislativeVotesSchema,
  validateLegislativeReferences,
  positionLabel,
  decisionLabel,
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
  validateLegislativeReferences(
    d,
    dataset,
    new Date(`${data.checked}T23:59:59Z`),
  );
test('les dossiers relient des propositions figées à des scrutins nominatifs institutionnels', () => {
  assert.deepEqual(valid(), []);
  for (const id of [
    'an14-647',
    'an15-49',
    'an16-1240',
    'an15-2059',
    'sen22-281',
    'sen23-109',
    'an15-928',
  ])
    assert.ok(
      data.ballots.some((b) => b.id === id),
      id,
    );
  for (const c of data.cases)
    assert.ok(dataset.versions.some((v) => v.id === c.versionId));
});
test('un même texte conserve des votes nominatifs distincts, et une déclaration son objet propre', () => {
  const immigration = data.ballots.find((b) => b.id === 'an16-3213');
  assert.deepEqual(
    Object.fromEntries(
      immigration.positions.map((p) => [
        p.candidate,
        positionLabel(p, immigration),
      ]),
    ),
    { lepen: 'Pour le texte', 'dupont-aignan': 'Abstention' },
  );
  const ukraine = data.ballots.find((b) => b.id === 'an16-3461');
  assert.equal(
    positionLabel(ukraine.positions[0], ukraine),
    'Contre la déclaration',
  );
  assert.equal(decisionLabel(ukraine), 'Déclaration approuvée');
  assert.equal(
    decisionLabel(data.ballots.find((b) => b.id === 'an17-4038')),
    'Amendement rejeté',
  );
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
    d.ballots.find((b) => b.kind === 'motion-censure').tally[key] = 0;
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
      d.ballots.find((b) => b.id === 'an16-1240').positions[0].officialName =
        'Cédric Roussel';
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

test('une édition de lecture appartient au scrutin, à sa chambre et à sa période de consultation', () => {
  for (const change of [
    (d) => d.readingSources.push(d.readingSources[0]),
    (d) => (d.readingSources[0].ballotId = 'inconnu'),
    (d) => (d.readingSources[0].ballotId = 'an16-1240'),
    (d) => (d.readingSources[0].url = 'https://example.org/releve'),
    (d) => (d.readingSources[0].checkedAt = '2010-01-01T00:00:00Z'),
    (d) => (d.readingSources[0].checkedAt = '2027-01-01T00:00:00Z'),
  ]) {
    const d = structuredClone(data);
    change(d);
    assert.ok(valid(d).length);
  }
});

test('les appels nominaux européens conservent le vote personnel et la chambre du document', () => {
  const european = data.ballots.filter(
    (b) => b.chamber === 'parlement-europeen',
  );
  const ceta = european.find((b) => b.id === 'pe8-20170215-ceta');
  const posting = european.find((b) => b.id === 'pe8-20180529-detachement');
  assert.equal(ceta.positions[0].choice, 'contre');
  assert.equal(posting.positions[0].choice, 'abstention');
  assert.equal(posting.tally.expressed, 603);
  const wrong = structuredClone(data);
  wrong.ballots.find((b) => b.id === ceta.id).chamber = 'assemblee';
  assert.ok(
    valid(wrong).some((error) =>
      error.includes('domaine institutionnel incohérent'),
    ),
  );
});
