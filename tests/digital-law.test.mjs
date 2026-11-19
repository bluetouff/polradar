import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  digitalLawPath,
  digitalLawSchema,
  validateDigitalLaw,
} from '../src/lib/digital-law.mjs';

const load = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  );
const config = digitalLawSchema.parse(load('digital-law'));
const dataset = {
  sources: load('sources'),
  versions: load('versions'),
  measures: load('measures'),
};
const now = new Date('2026-11-19T12:00:00Z');
const cases = config.sections.flatMap((section) => section.cases);

test('les situations ont des liens propres et des références officielles versionnées', () => {
  assert.deepEqual(validateDigitalLaw(config, dataset, now), []);
  assert.equal(digitalLawPath(cases[0].slug), '/numerique/ce-qui-changerait/');
  assert.equal(
    digitalLawPath(cases.find(({ id }) => id === 'publicite').slug),
    '/numerique/ce-qui-changerait/donnees-personnelles/publicite/',
  );
  for (const item of cases.filter(({ parliament }) => parliament)) {
    assert.equal(item.changes.length, 0);
    assert.ok(
      item.rules.every(({ refs }) =>
        refs.every(({ sourceId }) => sourceId === 'legifrance-csi-l871-1'),
      ),
    );
  }
});

test('le comparatif refuse une version inconnue, une archive et une référence juridique non institutionnelle', () => {
  const changed = structuredClone(config);
  const item = changed.sections[0].cases[0];
  item.changes[0].versionId = 'version-inconnue-v1';
  item.changes[1].versionId = dataset.versions.find(
    ({ snapshot }) => snapshot.scope === 'archive',
  ).id;
  item.rules[0].refs[0].sourceId = 'lfi-numerique';
  const errors = validateDigitalLaw(changed, dataset, now);
  assert.equal(
    errors.filter((error) => error.includes('version officielle invalide'))
      .length,
    2,
  );
  assert.ok(
    errors.some((error) => error.includes('référence juridique invalide')),
  );
});

test('une date future, une adresse en double ou un chemin externe sont invalides', () => {
  const changed = structuredClone(config);
  changed.asOf = '2026-11-20';
  changed.sections[0].cases[1].slug = changed.sections[0].cases[0].slug;
  const errors = validateDigitalLaw(changed, dataset, now);
  assert.ok(
    errors.some((error) => error.includes('date de consultation future')),
  );
  assert.ok(errors.some((error) => error.includes('adresse en double')));
  for (const slug of [
    '../retraites',
    'https://example.org/',
    'publicite#ailleurs',
  ]) {
    changed.sections[0].cases[0].slug = slug;
    assert.equal(digitalLawSchema.safeParse(changed).success, false);
  }
});
