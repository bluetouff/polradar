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
    ['climat-production-nucleaire', priority.filter((id) => id !== 'lepen')],
    ['immigration-travail', priority],
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
  expect(lepen?.positions).toHaveLength(0);
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
