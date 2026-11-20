import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  parsePortraits,
  portraitPermissions,
  unconfirmedRights,
} from '../src/lib/portrait-schema.mjs';
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

test('les autorisations particulières restent liées au portrait et au crédit vérifiés', () => {
  for (const permission of portraitPermissions) {
    const row = rows.find((item) => item.candidate === permission.candidate);
    assert.ok(row);
    assert.equal(parsePortraits([row], candidates).length, 1);
    for (const change of [
      (r) => (r.sourceUrl += '/autre-photo'),
      (r) => (r.licenseUrl += '/autre-autorisation'),
      (r) => (r.author = 'Autre photographe'),
      (r) => (r.license = 'CC BY 4.0'),
      (r) => (r.year = '2025'),
      (r) => (r.candidate = 'arthaud'),
    ]) {
      const copy = structuredClone(row);
      change(copy);
      assert.throws(() => parsePortraits([copy], candidates));
    }
  }
  const copy = structuredClone(rows[0]);
  copy.license = 'Autorisation de campagne';
  copy.licenseUrl = 'https://creativecommons.org/licenses/by/campagne';
  assert.throws(() => parsePortraits([copy], candidates));
});

test('le portrait Glucksmann écarté ne peut pas revenir avec son ancienne attribution Commons', () => {
  const copy = structuredClone(
    rows.find((row) => row.candidate === 'glucksmann'),
  );
  Object.assign(copy, {
    author: 'Xsolba',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Rapha%C3%ABl_Glucksmann,_espi%C3%A8gle,_place_Vend%C3%B4me,_le_7_septembre_2026.jpg',
    year: '2026',
  });
  assert.throws(() => parsePortraits([copy], candidates));
});

test('les portraits publiés sans autorisation documentée conservent leur source nominative et leur statut', () => {
  const selected = rows.filter((row) => row.license === unconfirmedRights);
  assert.ok(selected.length > 0);
  for (const row of selected) {
    assert.equal(row.licenseUrl, null);
    for (const change of [
      { sourceUrl: 'https://example.org/portrait' },
      { licenseUrl: 'https://creativecommons.org/licenses/by/4.0' },
      { license: 'CC BY 4.0' },
      { candidate: 'arthaud', file: 'arthaud.jpg' },
    ])
      assert.throws(() => parsePortraits([{ ...row, ...change }], candidates));
  }
});

test('les fichiers et les crédits publiés correspondent à la revue photographique', () => {
  const reviewed = read('portraits-reviewed');
  assert.match(reviewed.reviewedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(new Date(reviewed.reviewedAt) <= new Date());
  assert.equal(reviewed.portraits.length, rows.length);
  assert.equal(
    new Set(reviewed.portraits.map((p) => p.candidate)).size,
    rows.length,
  );
  for (const row of rows) {
    const approved = reviewed.portraits.find(
      (p) => p.candidate === row.candidate,
    );
    assert.ok(approved, `Portrait à revoir : ${row.candidate}`);
    const bytes = readFileSync(
      new URL('../src/assets/portraits/' + row.file, import.meta.url),
    );
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      approved.imageSha256,
    );
    const credit = JSON.stringify(row, Object.keys(row).sort());
    assert.equal(
      createHash('sha256').update(credit).digest('hex'),
      approved.creditSha256,
    );
  }
});
