import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  digitalComparisonSchema,
  digitalComparePath,
  validateDigitalComparison,
} from '../src/lib/digital-comparison.mjs';

const read = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  );
const config = digitalComparisonSchema.parse(read('digital-comparison'));
const dataset = Object.fromEntries(
  ['candidates', 'measures', 'versions', 'sources'].map((name) => [
    name,
    read(name),
  ]),
);
const consultation = new Date('2026-11-19T10:00:00Z');

test('le comparatif utilise des versions officielles et une seule proposition par profil et par ligne', () => {
  assert.deepEqual(
    validateDigitalComparison(config, dataset, consultation),
    [],
  );
  assert.deepEqual(
    config.axes.map(({ id }) => digitalComparePath(id)),
    [
      '/numerique/comparer/',
      '/numerique/comparer/chiffrement/',
      '/numerique/comparer/souverainete/',
    ],
  );
  const duplicate = structuredClone(config);
  duplicate.axes[0].rows[0].entries.push(duplicate.axes[0].rows[0].entries[0]);
  assert.ok(
    validateDigitalComparison(duplicate, dataset, consultation).some((msg) =>
      msg.includes('profil en double'),
    ),
  );
  const missing = structuredClone(config);
  missing.axes[0].rows[0].entries[0].versionId = 'fiche-absente-v1';
  assert.ok(
    validateDigitalComparison(missing, dataset, consultation).some((msg) =>
      msg.includes('version ou référence invalide'),
    ),
  );
  const orphan = structuredClone(config);
  orphan.axes[0].rows[0].entries[0].amountOnly = true;
  assert.ok(
    validateDigitalComparison(orphan, dataset, consultation).some((msg) =>
      msg.includes('version ou référence invalide'),
    ),
  );
});

test('les publications de parti et l’entretien conservent leur attribution', () => {
  const fiche = (id) => dataset.measures.find((item) => item.id === id);
  assert.equal(fiche('roussel-securite-centre-public-cyber').scope, 'parti');
  assert.equal(
    fiche('dupont-aignan-institutions-chiffrement-sensible').scope,
    'parti',
  );
  assert.equal(fiche('tondelier-institutions-outils-chiffres').scope, 'parti');
  assert.equal(
    fiche('glucksmann-europe-fonds-alternatives-numeriques').scope,
    'parti',
  );
  assert.equal(
    fiche('lisnard-securite-maitrise-cyber-etat').scope,
    'orientation',
  );
  assert.equal(fiche('retailleau-institutions-achats-numeriques').revision, 2);
});

test('le scrutin n° 9794 conserve son objet et le décompte officiel', () => {
  const { vote, statements } = config.parliament;
  // Scrutin public du 10 novembre 2026 sur l'amendement de suppression.
  assert.deepEqual(
    [
      vote.number,
      vote.date,
      vote.voters,
      vote.expressed,
      vote.for,
      vote.against,
      vote.abstained,
    ],
    [9794, '2026-11-10', 107, 106, 69, 37, 1],
  );
  assert.equal(vote.textSourceId, 'assemblee-resilience-amendement-358');
  assert.deepEqual(
    statements.map(({ author, position }) => [author, position]),
    [
      ['Emeric Salmon', 'Retirer l’article'],
      ['René Pilato', 'Maintenir l’article'],
      ['Catherine Hervieu', 'Maintenir l’article'],
    ],
  );
  const wrong = structuredClone(config);
  wrong.parliament.vote.for += 1;
  assert.ok(
    validateDigitalComparison(wrong, dataset, consultation).some((msg) =>
      msg.includes('suffrages'),
    ),
  );
  const wronglyAttributed = structuredClone(dataset);
  wronglyAttributed.sources.find(({ id }) => id === vote.sourceId).kind =
    'campagne';
  assert.ok(
    validateDigitalComparison(config, wronglyAttributed, consultation).some(
      (msg) => msg.includes('institutionnelle invalide'),
    ),
  );
});

test('les montants en cybersécurité conservent leurs périmètres et leurs périodes', () => {
  const data = (id) =>
    dataset.versions.find((v) => v.id === id).snapshot.amounts[0];
  const vauban = data('retailleau-institutions-plan-vauban-cyber-v1');
  const equinoxe = data('mikolajczak-travail-ia-numerique-v1');
  assert.deepEqual(
    [vauban.value, vauban.unit, vauban.period],
    [2300000000, '€', 'mandat'],
  );
  assert.deepEqual(
    [equinoxe.value, equinoxe.unit, equinoxe.period],
    [700000000, '€', 'an'],
  );
  assert.match(equinoxe.label, /pour 2027/);
});
