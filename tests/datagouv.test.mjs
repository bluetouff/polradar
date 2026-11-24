import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareDatagouv } from '../scripts/preparer-datagouv.mjs';
import { dataLicence, publicExports } from '../src/lib/public-exports.mjs';

const origin = 'https://polradar.fr';
const documents = publicExports.find(({ id }) => id === 'documents');
const bytes = Buffer.from('{"schemaVersion":1,"documents":[]}\n');

function fixture(sha = 'a'.repeat(40)) {
  const url = origin + documents.path;
  const archive =
    'https://github.com/bluetouff/polradar/releases/download/site-' +
    sha +
    '/corpus-v1.tar.gz';
  return [
    {
      version: 1,
      edition: '2026-11-24',
      sourceCommit: sha,
      archive,
      catalogueDCAT: origin + '/api/catalogue-dcat.json',
      licence: dataLicence,
      jeux: [{ id: documents.id, url, droits: { url: documents.rights.url } }],
    },
    {
      'dcat:dataset': [
        {
          'dct:identifier': documents.id,
          'dcat:version': sha,
          'dcat:distribution': [
            {
              'dcat:downloadURL': { '@id': url },
              'dct:license': { '@id': documents.rights.url },
            },
          ],
        },
      ],
    },
  ];
}

test('la fiche du portail reste stable et l’empreinte décrit le JSON exact', () => {
  const a = prepareDatagouv(...fixture(), bytes);
  const b = prepareDatagouv(...fixture('b'.repeat(40)), bytes);
  assert.deepEqual(a.dataset, b.dataset);
  assert.deepEqual(a.resources, b.resources);
  assert.equal(a.dataset.license, 'odc-odbl');
  assert.equal(a.dataset.frequency, 'irregular');
  assert.deepEqual(
    a.resources.filter(({ type }) => type === 'main').map(({ url }) => url),
    [origin + documents.path],
  );
  assert.ok(a.resources.every(({ filetype }) => filetype === 'remote'));
  assert.equal(a.edition.fichier, 'api/documents.json');
  assert.equal(a.edition.references, 0);
  assert.equal(
    a.edition.sha256,
    createHash('sha256').update(bytes).digest('hex'),
  );
  assert.notEqual(a.edition.archive, b.edition.archive);
  const other = Buffer.from(bytes.toString().trim());
  assert.notEqual(
    prepareDatagouv(...fixture(), other).edition.sha256,
    a.edition.sha256,
  );
});

test('une archive tierce, une licence incohérente ou un catalogue décalé interrompt la préparation', () => {
  for (const mutate of [
    (catalog) => {
      catalog.archive = 'https://example.org/fichier.tar.gz';
    },
    (catalog) => {
      catalog.jeux[0].droits = {
        url: 'https://creativecommons.org/licenses/by/4.0/',
      };
    },
    (catalog) => {
      catalog.sourceCommit = '';
    },
    (_catalog, dcat) => {
      dcat['dcat:dataset'][0]['dcat:version'] = 'b'.repeat(40);
    },
    (_catalog, dcat) => {
      dcat['dcat:dataset'][0]['dcat:distribution'] = [];
    },
  ]) {
    const pair = fixture();
    mutate(...pair);
    assert.throws(() => prepareDatagouv(...pair, bytes));
  }
  assert.throws(() => prepareDatagouv(...fixture(), Buffer.from('{}')));
});
