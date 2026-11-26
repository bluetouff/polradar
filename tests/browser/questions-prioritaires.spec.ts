import { test, expect } from '@playwright/test';

const priority = ['glucksmann', 'lepen', 'lisnard', 'melenchon', 'philippe'];
const ukraine = '/questions/aide-ukraine/';
type PublicQuestion = {
  id: string;
  positions: {
    candidate: string;
    positions: { sources: { locator: string; url: string }[] }[];
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
  for (const questionId of [
    'aide-ukraine',
    'retraites-conditions-depart',
    'climat-production-nucleaire',
    'immigration-travail',
  ]) {
    const question = questions.find(({ id }) => id === questionId);
    for (const candidate of priority) {
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
