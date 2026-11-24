import assert from 'node:assert/strict';
import test from 'node:test';
import candidates from '../src/data/candidates.json' with { type: 'json' };
import measures from '../src/data/measures.json' with { type: 'json' };
import sources from '../src/data/sources.json' with { type: 'json' };
import versions from '../src/data/versions.json' with { type: 'json' };
import { proposalWording } from '../src/lib/proposal-wording.mjs';

function example(rows) {
  return proposalWording({
    measures: rows,
    candidates: [{ id: 'exemple', name: 'Auteur individuel' }],
    sources: [
      {
        id: 'source-a',
        title: 'Document A',
        url: 'https://example.org/a.pdf',
      },
      {
        id: 'source-b',
        title: 'Document B',
        url: 'https://example.org/b.pdf#section',
      },
    ],
    versions: rows.map(({ id, revision }) => ({
      id: id + '-v' + revision,
      measureId: id,
      number: revision,
    })),
  });
}

const mesure = {
  id: 'formulation-a',
  revision: 2,
  title: 'Créer une dotation annuelle pour les communes de montagne',
  description:
    'Créer une dotation annuelle de 10 millions d’euros pour les communes de montagne.',
  scope: 'campagne',
  candidate: 'exemple',
  theme: 'institutions',
  beneficiaries: 'Communes de montagne',
  timing: 'À partir de 2028',
  financing: null,
  edition: 'Document A',
  checked: '2026-11-24',
  metrics: [],
  amounts: [
    {
      label: 'Dotation',
      value: 10,
      unit: 'millions d’euros',
      period: 'an',
      basis: 'non-applicable',
      sourceId: 'source-a',
    },
  ],
  sourceRefs: [{ sourceId: 'source-a', locator: 'Chapitre 2' }],
};

test('le rapprochement révèle les différences sans réattribuer ni fusionner', () => {
  const autre = {
    ...mesure,
    id: 'formulation-b',
    title: 'Ne pas créer de dotation annuelle pour les communes de montagne',
    description:
      'Ne pas créer cette dotation à hauteur de 15 millions d’euros.',
    scope: 'parti',
    partyAuthor: 'Auteur collectif',
    beneficiaries: 'Toutes les communes',
    amounts: [],
    sourceRefs: [
      { sourceId: 'source-b', locator: 'Page 5', fragment: 'page=5' },
    ],
  };
  const rapport = example([autre, mesure]);
  assert.deepEqual(rapport, example([mesure, autre]));
  assert.equal(rapport.fiches.length, 2);
  assert.deepEqual(rapport.paires[0].ecarts, [
    'nombre',
    'portee',
    'auteur',
    'beneficiaires',
    'negation',
  ]);
  assert.deepEqual(
    rapport.fiches.map(({ version, auteur, sources, titre }) => [
      version,
      auteur,
      sources[0].url,
      titre,
    ]),
    [
      [
        'formulation-a-v2',
        'Auteur individuel',
        'https://example.org/a.pdf',
        mesure.title,
      ],
      [
        'formulation-b-v2',
        'Auteur collectif',
        'https://example.org/b.pdf#page=5',
        autre.title,
      ],
    ],
  );
});

test('une unité ou une période différente déclenche un écart chiffré', () => {
  const source = { sourceId: 'source-b', locator: 'Page 5' };
  const autre = {
    ...mesure,
    id: 'formulation-b',
    amounts: [{ ...mesure.amounts[0], period: 'mandat' }],
    sourceRefs: [source],
  };
  assert.deepEqual(example([autre, mesure]).paires[0].ecarts, ['nombre']);
  const meme = { ...autre, amounts: mesure.amounts };
  assert.equal(example([meme, mesure]).groupesIdentiques, 1);
  assert.deepEqual(example([meme, mesure]).paires, []);
});

test('les archives, les autres thèmes et le vocabulaire générique restent écartés', () => {
  const rapport = example([
    mesure,
    { ...mesure, id: 'archive', scope: 'archive' },
    { ...mesure, id: 'autre-theme', theme: 'sante' },
    {
      ...mesure,
      id: 'distinct',
      title: 'Étendre les transports publics fluviaux',
      description: 'Accélérer la rénovation des voies navigables.',
    },
  ]);
  assert.equal(rapport.fichesCourantesExaminees, 3);
  assert.deepEqual(rapport.paires, []);
});

test('les paires du corpus gardent leur version, leur passage et leurs valeurs', () => {
  const rapport = proposalWording({ measures, candidates, sources, versions });
  assert.equal(
    rapport.fichesCourantesExaminees,
    measures.filter((row) => row.scope !== 'archive').length,
  );
  const rows = new Map(rapport.fiches.map((row) => [row.id, row]));
  const ids = ['melenchon-retraites-1', 'philippe-retraites-1'];
  const pair = rapport.paires.find((row) => row.fiches.join() === ids.join());
  assert.ok(
    pair.ecarts.includes('nombre') && pair.ecarts.includes('beneficiaires'),
  );
  assert.deepEqual(
    ids.map(
      (id) =>
        rows.get(id).indicateurs.find((m) => m.key === 'age-depart').value,
    ),
    [60, 65],
  );
  const refIds = new Set(sources.map((source) => source.id));
  const versionIds = new Set(versions.map((row) => row.id));
  for (const row of rapport.fiches) {
    assert.ok(versionIds.has(row.version));
    assert.ok(
      row.sources.length > 0 &&
        row.sources.every((ref) => refIds.has(ref.id) && ref.passage),
    );
  }
});
