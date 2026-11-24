import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDocumentRegister } from '../src/lib/document-register.ts';
const read = (name) =>
  JSON.parse(
    readFileSync(
      new URL('../src/data/' + name + '.json', import.meta.url),
      'utf8',
    ),
  );
const corpus = {
  sources: read('sources'),
  documentAuthors: read('document-authors'),
  measures: read('measures'),
  candidates: read('candidates'),
  events: read('events'),
  engagements: read('engagements'),
  watch: read('watch'),
};
const audits = read('document-coverage');
test('Le registre conserve chaque référence, chaque passage et la précision de la date', () => {
  const result = buildDocumentRegister(corpus, audits);
  assert.equal(result.length, corpus.sources.length);
  assert.equal(
    result.reduce((n, d) => n + d.passages.length, 0),
    corpus.measures.reduce((n, m) => n + m.sourceRefs.length, 0),
  );
  for (const d of result) {
    assert.equal(
      d.measureCount,
      new Set(d.passages.map((p) => p.measureId)).size,
    );
    const s = corpus.sources.find((s) => s.id === d.id);
    assert.equal(d.publication.value, s.published ?? s.publishedYear ?? null);
    assert.equal(
      d.publication.precision,
      s.published ? 'jour' : s.publishedYear ? 'année' : 'inconnue',
    );
    if (!audits.some((a) => a.sourceId === d.id))
      assert.equal(d.coverage, null);
    if (!corpus.documentAuthors[d.id]) assert.equal(d.author, null);
  }
  assert.ok(result.some((d) => !d.publication.value));
  assert.ok(result.some((d) => d.publication.precision === 'année'));
  assert.ok(result.some((d) => d.measureCount === 0 && d.candidates.length));
  const mathieu = result.find((d) => d.id === 'mathieu-projet-2027');
  assert.deepEqual([mathieu.coverage.linked, mathieu.coverage.total], [5, 5]);
  assert.ok(
    result.some((d) =>
      d.coverage?.units.some((u) => u.measureIds.length === 0),
    ),
  );
});
test('Les doubles comptes et les rapprochements sans citation du document échouent', () => {
  const section = audits[0],
    unit = section.units[0];
  assert.throws(
    () => buildDocumentRegister(corpus, [section, section]),
    /répété/,
  );
  assert.throws(
    () => buildDocumentRegister(corpus, [{ ...section, units: [unit, unit] }]),
    /double/,
  );
  assert.throws(
    () =>
      buildDocumentRegister(corpus, [
        { ...section, units: [{ ...unit, measureIds: ['inconnu'] }] },
      ]),
    /ne cite/,
  );
  assert.throws(
    () => buildDocumentRegister(corpus, [{ ...section, sourceId: 'inconnu' }]),
    /absent/,
  );
});

test('Auteur, organisation, nature du document, traitement et droits de réutilisation sont indépendants', () => {
  const details = read('document-details');
  const rows = new Map(
    buildDocumentRegister(corpus, audits, details).map((d) => [d.id, d]),
  );
  const book = rows.get('mlekuz-programme-detaille');
  assert.equal(book.documentType, 'Livre blanc');
  assert.equal(book.organization, 'Démocratie Ouverte');
  assert.match(book.reuse.label, /Trajectoire/);
  assert.equal(rows.get('mathieu-projet-2027').reuse, null);
  assert.equal(rows.get('mathieu-projet-2027').processing, 'périmètre relu');
  assert.ok(
    [...rows.values()].some(
      (d) => d.processing === 'référence identifiée' && !d.organization,
    ),
  );
  assert.ok(
    [...rows.values()].some(
      (d) => d.processing === 'passages localisés' && !d.coverage,
    ),
  );
  assert.throws(
    () =>
      buildDocumentRegister(corpus, audits, {
        ...details,
        absent: details['mathieu-projet-2027'],
      }),
    /sans document/,
  );
  assert.throws(() =>
    buildDocumentRegister(corpus, audits, {
      'mlekuz-programme-detaille': {
        ...details['mlekuz-programme-detaille'],
        reuse: { label: 'Droits', url: 'http://localhost/' },
      },
    }),
  );
});
