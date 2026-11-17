import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parsePortraits } from '../src/lib/portrait-schema.mjs';
const read = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)),
  );
const rows = read('portraits'),
  candidates = read('candidates');
test('les portraits réels ont un fichier local, une attribution et une licence cohérente', () => {
  assert.equal(parsePortraits(rows, candidates).length, rows.length);
  for (const row of rows) {
    assert.ok(
      existsSync(
        new URL('../src/assets/portraits/' + row.file, import.meta.url),
      ),
    );
    assert.ok(row.author.length);
  }
});
test('un portrait ambigu, une licence différente ou un chemin non local bloque la construction', () => {
  for (const change of [
    (r) => (r.candidate = 'inconnu'),
    (r) => (r.file = '../portrait.jpg'),
    (r) => (r.file = 'autre.jpg'),
    (r) => (r.license = 'Tous droits réservés'),
    (r) => (r.licenseUrl = 'https://example.org/licence'),
    (r) => (r.sourceUrl = 'https://example.org/photo'),
    (r) => (r.author = ''),
    (r) => (r.year = '2099'),
  ]) {
    const copy = structuredClone(rows);
    change(copy[0]);
    assert.throws(() => parsePortraits(copy, candidates));
  }
  assert.throws(() => parsePortraits([...rows, rows[0]], candidates));
});
