import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

test('les relations publiées conservent les références, la date et la version', async ({
  request,
}) => {
  const paths = [
    '/build.json',
    '/api/relations-documentaires.json',
    '/api/dossiers.json',
    '/api/exports-v1.json',
  ];
  const [build, index, dossiers, downloads] = await Promise.all(
    paths.map(async (path) => {
      const response = await request.get(path);
      expect(response.ok(), path).toBeTruthy();
      return response;
    }),
  );
  const manifest = await build.json();
  const catalogueBytes = await downloads.body();
  expect(createHash('sha256').update(catalogueBytes).digest('hex')).toBe(
    manifest.sha256['api/exports-v1.json'],
  );
  const { relations, sourceCommit, version } = await index.json();
  expect(sourceCommit).toBe(manifest.sourceCommit);
  expect(version).toBe(1);
  expect(new Set(relations.map((row: { id: string }) => row.id)).size).toBe(
    relations.length,
  );
  expect((await downloads.json()).jeux).toContainEqual(
    expect.objectContaining({
      id: 'relations-documentaires',
      url: 'https://polradar.fr/api/relations-documentaires.json',
    }),
  );

  const previous = relations.find(
    ({ origin, type }: { origin: { id: string }; type: string }) =>
      origin.id === 'melenchon-education-2-v3' && type === 'version-precedente',
  );
  expect(previous).toMatchObject({
    qualification: 'correction',
    target: { id: 'melenchon-education-2-v2' },
    date: { type: 'enregistrement' },
  });
  expect((await request.get(previous.target.url)).ok()).toBeTruthy();
  expect(previous.sources).toContainEqual(
    expect.objectContaining({
      url: expect.stringContaining('melenchon2027.fr/programme/'),
      passage: expect.stringContaining('classe'),
    }),
  );

  const vote = (await dossiers.json()).votes.find(
    ({ relation }: { relation?: { relation: string } }) =>
      relation?.relation === 'texte-plus-large',
  );
  expect(relations).toContainEqual(
    expect.objectContaining({
      type: 'rapprochement-scrutin',
      origin: expect.objectContaining({ id: vote.versionId }),
      target: expect.objectContaining({ id: vote.ballotId }),
      qualification: 'texte-plus-large',
      justification: vote.relation.context,
      sources: [expect.objectContaining({ url: vote.rollCall.url })],
    }),
  );
  expect(relations).toContainEqual(
    expect.objectContaining({
      type: 'comparaison-droit',
      date: expect.objectContaining({ type: 'droit-verifie-le' }),
      sources: expect.arrayContaining([
        expect.objectContaining({
          url: expect.stringContaining('legifrance.gouv.fr'),
        }),
      ]),
    }),
  );
  expect(relations).toContainEqual(
    expect.objectContaining({
      type: 'poste-budgetaire',
      date: expect.objectContaining({ type: 'relecture' }),
      sources: expect.arrayContaining([
        expect.objectContaining({ passage: expect.any(String) }),
      ]),
    }),
  );
});

test('le graphe distingue les réponses aux questions, les compléments et les versions dépassées', async ({
  request,
}) => {
  const [graph, dossiers] = await Promise.all(
    ['/api/relations-documentaires.json', '/api/dossiers.json'].map(
      async (path) => {
        const response = await request.get(path);
        expect(response.ok(), path).toBeTruthy();
        return response.json();
      },
    ),
  );
  const id = 'lepen-renegocier-prix-electricite-europe-v3';
  const target = '/mesures/lepen-renegocier-prix-electricite-europe/#version-3';
  const relations = graph.relations.filter(
    (row: { type: string; target: { id: string } }) =>
      row.type === 'question-proposition' && row.target.id === id,
  );
  const nuclear = 'climat-production-nucleaire';
  const prices = 'climat-prix-energie';
  const edge = (question: string, qualification: string) =>
    expect.objectContaining({
      id: `question-proposition:${question}:${id}`,
      origin: {
        id: question,
        type: 'question',
        url: `/questions/${question}/`,
      },
      target: { id, type: 'version', url: target },
      qualification,
      statut: 'version-courante',
      versionCitee: id,
      versionCourante: id,
      regleVersion: 'version-citee',
      sources: expect.arrayContaining([
        expect.objectContaining({
          id: 'lepen-livret-energie',
          passage: expect.stringContaining('p. 2'),
        }),
      ]),
    });
  expect(relations).toEqual(
    expect.arrayContaining([
      edge(nuclear, 'complement'),
      edge(prices, 'reponse'),
    ]),
  );
  expect(relations).not.toContainEqual(edge(nuclear, 'reponse'));
  const candidateRow = (question: string) =>
    dossiers.questions
      .find((q: { id: string }) => q.id === question)
      .positions.find((p: { candidate: string }) => p.candidate === 'lepen');
  expect(candidateRow(nuclear).positions).not.toContainEqual(
    expect.objectContaining({ versionId: id }),
  );
  expect(candidateRow(nuclear).complements).toContainEqual(
    expect.objectContaining({
      versionId: id,
      relation: expect.objectContaining({ qualification: 'complement' }),
    }),
  );
  expect(candidateRow(prices).positions).toContainEqual(
    expect.objectContaining({
      versionId: id,
      relation: expect.objectContaining({ qualification: 'reponse' }),
    }),
  );
  const previous = graph.relations.find(
    (row: { id: string }) =>
      row.id ===
      'question-proposition:salaires-enseignants:branco-salaires-enseignants-debut-carriere-v1',
  );
  expect(previous).toMatchObject({
    qualification: 'reponse',
    statut: 'version-depassee',
    versionCitee: 'branco-salaires-enseignants-debut-carriere-v1',
    versionCourante: 'branco-salaires-enseignants-debut-carriere-v2',
    regleVersion: 'version-citee',
    date: { type: 'observation-version', value: '2026-11-25' },
    target: {
      url: '/mesures/branco-salaires-enseignants-debut-carriere/#version-1',
    },
    sources: expect.arrayContaining([
      expect.objectContaining({
        id: 'branco-voie-pdf',
        passage: expect.stringContaining('page 37'),
      }),
    ]),
  });
});
