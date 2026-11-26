import { test, expect } from '@playwright/test';

const priority = ['glucksmann', 'lepen', 'lisnard', 'melenchon', 'philippe'];
const ukraine = '/questions/aide-ukraine/';
type PublicReading = {
  sources: { locator: string; url: string }[];
};
type PublicQuestion = {
  id: string;
  positions: {
    candidate: string;
    positions: PublicReading[];
    complements: PublicReading[];
  }[];
};

test('les cinq dossiers prioritaires renvoient à une position originale sur l’Ukraine', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/themes/europe/');
  await page
    .getByRole('link', {
      name: 'La France devrait-elle poursuivre son aide à l’Ukraine ?',
    })
    .click();
  for (const id of priority) {
    const answer = page.locator('#candidat-' + id);
    await expect(answer).toBeVisible();
    await expect(
      answer
        .getByRole('link', { name: /Soutenir|Poursuivre|Accélérer|Mettre fin/ })
        .first(),
    ).toHaveAttribute('href', /^\/mesures\//);
  }
  await expect(page.locator('#candidat-melenchon')).toContainText(
    'Projet de parti · La France insoumise',
  );
  await expect(page.locator('#candidat-lisnard')).toContainText(
    'Nouvelle Énergie',
  );

  await page.goto('/candidats/glucksmann/');
  await page
    .getByRole('link', {
      name: 'La France devrait-elle poursuivre son aide à l’Ukraine ?',
    })
    .click();
  await expect(page).toHaveURL(new RegExp(ukraine + '#candidat-glucksmann$'));
  await page
    .locator('#candidat-glucksmann')
    .getByRole('link', { name: /Accélérer et renforcer/ })
    .click();
  await expect(page).toHaveURL(
    /\/mesures\/glucksmann-renforcer-aide-ukraine\/#version-1$/,
  );
  await expect(
    page.getByRole('link', { name: /tribune sur l’aide à l’Ukraine/ }).first(),
  ).toHaveAttribute('href', /^https:\/\/place-publique\.eu\/posts\//);

  const response = await request.get('/api/dossiers.json');
  expect(response.ok()).toBeTruthy();
  const { questions }: { questions: PublicQuestion[] } = await response.json();
  for (const [questionId, candidates] of [
    ['aide-ukraine', priority],
    ['retraites-conditions-depart', priority],
    ['climat-production-nucleaire', priority],
    ['immigration-travail', priority],
    ['education-acces-etudes', priority],
    ['retraites-protection-revenus', priority],
  ] as const) {
    const question = questions.find(({ id }) => id === questionId);
    for (const candidate of candidates) {
      const column = question?.positions.find(
        (entry) => entry.candidate === candidate,
      );
      expect(
        column?.positions.length,
        questionId + ' · ' + candidate,
      ).toBeGreaterThan(0);
      expect(
        column?.positions.every(({ sources }) =>
          sources.some(
            ({ locator, url }) => locator && url.startsWith('https://'),
          ),
        ),
      ).toBeTruthy();
    }
  }
  const lepen = questions
    .find(({ id }) => id === 'climat-production-nucleaire')
    ?.positions.find(({ candidate }) => candidate === 'lepen');
  expect(lepen?.positions).toContainEqual(
    expect.objectContaining({
      versionId: 'groupe-rn-accroitre-production-nucleaire-2025-v1',
      author: 'Groupe Rassemblement national',
      scope: 'parti',
      relation: expect.objectContaining({ qualification: 'reponse' }),
    }),
  );
  expect(lepen?.complements).toContainEqual(
    expect.objectContaining({
      versionId: 'lepen-renegocier-prix-electricite-europe-v3',
      relation: expect.objectContaining({ qualification: 'complement' }),
      sources: expect.arrayContaining([
        expect.objectContaining({
          locator: 'Fixation du prix de l’électricité · p. 2 du PDF',
          url: 'https://www.marinelepen.com/materiel-de-campagne/3/telecharger#page=2',
        }),
      ]),
    }),
  );
});

test('le lien du comparateur ouvre trois réponses documentées sur mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(
    '/comparer/?question=aide-ukraine&c=glucksmann,philippe,melenchon',
  );
  await expect(page.locator('#comparaison-glucksmann')).toContainText(
    'soutien militaire européen',
  );
  await expect(page.locator('#comparaison-philippe')).toContainText(
    'soutien financier et opérationnel',
  );
  await expect(page.locator('#comparaison-melenchon')).toContainText(
    'La France insoumise',
  );
  await expect(
    page.getByText('Position non documentée', { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});

test('une position nouvellement reliée se retrouve depuis la candidature et le comparateur', async ({
  page,
}) => {
  await page.goto('/candidats/batho/');
  await page.locator('.profile-question-index > summary').click();
  await page
    .locator('a[href="/questions/sante-installation-medecins/#candidat-batho"]')
    .click();
  const position = page.locator('#candidat-batho');
  await expect(position).toContainText('Réguler l’installation des médecins');
  const sources = position.locator('details.q-citations').first();
  await sources.locator('summary').click();
  await expect(
    sources.locator(
      'a[href^="https://www.delphinebatho.fr/priorites/la-pleine-sante/"]',
    ),
  ).toHaveCount(1);

  await page.goto(
    '/comparer/?question=sante-installation-medecins&c=batho,branco',
  );
  await expect(page.locator('#comparaison-batho')).toContainText(
    'Réguler l’installation des médecins',
  );
  await expect(page.locator('#comparaison-batho')).toContainText(
    'centres de santé',
  );
});

test('la fiche Tinland relie le portrait, le programme et le référendum à leurs sources', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/candidats/tinland/');
  await expect(
    page.getByRole('heading', { name: 'Serge Tinland', level: 1 }),
  ).toBeVisible();
  const portrait = page.locator('.profile-portrait img');
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveJSProperty('complete', true);
  expect(
    await portrait.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  await expect(
    page.locator('a[href="/credits-photos/#tinland"]'),
  ).toBeVisible();

  const programme = page.locator('.programme-reading');
  await programme.locator('summary').click();
  await expect(programme).toContainText('26 sections identifiées');
  await expect(
    programme.getByRole('link', { name: 'Politique européenne' }),
  ).toHaveAttribute(
    'href',
    'https://www.sergetinland2027.fr/politique-europeenne/',
  );

  await page.goto(
    '/recherche/#candidate=tinland&type=mesure&q=r%C3%A9f%C3%A9rendum+union',
  );
  await expect(
    page.locator(
      '#search-results a[href="/mesures/tinland-referendum-union-europeenne/"]',
    ),
  ).toBeVisible();
  await page.goto(
    '/comparer/?question=europe-participation-union&c=tinland,melenchon',
  );
  await expect(page.locator('#comparaison-tinland')).toContainText(
    'Organiser un référendum sur la sortie de l’Union européenne',
  );
  await expect(page.locator('#comparaison-melenchon')).toContainText(
    'Rester dans l’Union et la zone euro',
  );
  await page.goto('/mesures/tinland-referendum-union-europeenne/');
  await expect(
    page
      .locator(
        'a[href^="https://www.sergetinland2027.fr/politique-europeenne/#:~:text="]',
      )
      .first(),
  ).toBeVisible();
  await expect(page.locator('main')).toContainText('En cas de oui');
});

test('les propositions des six candidatures sont indexées avec leur attribution', async ({
  request,
}) => {
  const corpusResponse = await request.get('/api/corpus.json');
  const searchResponse = await request.get('/api/recherche.json');
  expect(corpusResponse.ok() && searchResponse.ok()).toBeTruthy();
  const {
    measures,
  }: {
    measures: {
      id: string;
      candidate: string;
      scope: string;
      displayAuthor: string;
    }[];
  } = await corpusResponse.json();
  const search: {
    url: string;
    candidate: string;
    scope: string;
    author: string;
  }[] = await searchResponse.json();
  const byURL = new Map(search.map((row) => [row.url, row]));
  for (const candidate of [...priority, 'tinland']) {
    const records = measures.filter(
      (m) => m.candidate === candidate && m.scope !== 'archive',
    );
    expect(records.length, candidate).toBeGreaterThan(0);
    const missing = records.filter((m) => {
      const row = byURL.get('/mesures/' + m.id + '/');
      return (
        row?.candidate !== candidate ||
        row.scope !== m.scope ||
        row.author !== m.displayAuthor
      );
    });
    expect(
      missing.map(({ id }) => id),
      candidate,
    ).toEqual([]);
  }
});

test('la recherche de mesures sur Parcoursup retrouve les nouvelles positions', async ({
  page,
}) => {
  for (const [candidate, measure] of [
    ['lepen', 'lepen-publier-criteres-admission-superieur'],
    ['lisnard', 'lisnard-remplacer-parcoursup-orientation'],
    ['philippe', 'philippe-conserver-ameliorer-parcoursup-orientation'],
  ]) {
    await page.goto(
      `/recherche/#candidate=${candidate}&type=mesure&q=parcoursup`,
    );
    await expect(
      page.locator(`#search-results a[href="/mesures/${measure}/"]`),
    ).toBeVisible();
  }
});
