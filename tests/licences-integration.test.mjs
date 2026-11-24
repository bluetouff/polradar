import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rights } from '../src/lib/licences.mjs';
import { rechercherMesures } from '../integrations/javascript/polradar.mjs';
test('les huit familles disposent de la licence demandée, indépendante des dépendances', () => {
  assert.deepEqual(
    rights.map(({ id, licence }) => [id, licence]),
    [
      ['astro', 'AGPL-3.0-only'],
      ['services', 'AGPL-3.0-only'],
      ['collecte', 'AGPL-3.0-only'],
      ['corpus', 'ODbL-1.0'],
      ['editions', 'CC-BY-4.0'],
      ['integration', 'MIT'],
      ['identite', 'Droits réservés'],
      ['tiers', 'Licences d’origine'],
    ],
  );
  assert.equal(
    JSON.parse(readFileSync('package-lock.json')).packages[''].license,
    'AGPL-3.0-only',
  );
  assert.match(readFileSync('integrations/LICENSE', 'utf8'), /MIT License/);
});
test('le SDK encode les termes sur la seule API publique et conserve les sources', async (t) => {
  const body = {
    versionContrat: 1,
    revisionDuSite: 'ed',
    donnees: { resultats: [] },
  };
  const mock = t.mock.method(globalThis, 'fetch', async (url, opts) => {
    assert.equal(url.origin, 'https://polradar.fr');
    assert.equal(url.pathname, '/api/v1/mesures');
    assert.equal(url.searchParams.get('query'), 'retraite & santé');
    assert.equal(opts.credentials, 'omit');
    return Response.json(body);
  });
  await assert.rejects(rechercherMesures(' '));
  await assert.rejects(rechercherMesures('x', 21));
  assert.deepEqual(await rechercherMesures('retraite & santé', 2), body);
  assert.equal(mock.mock.callCount(), 1);
  mock.mock.mockImplementation(async () => new Response(null, { status: 503 }));
  await assert.rejects(rechercherMesures('x'), /503/);
  mock.mock.mockImplementation(async () => Response.json({}));
  await assert.rejects(rechercherMesures('x'), /inconnu/);
});
