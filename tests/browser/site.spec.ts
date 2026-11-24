import { testOrigin } from './origin';
import { test, expect } from '@playwright/test';

test('les pages restent lisibles sur mobile et bureau', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/candidats/',
      '/candidats/philippe/',
      '/comparer/',
      '/economie/',
      '/sources/',
    ]) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `${route} à ${width}px`).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});
test('le comparateur conserve une sélection de deux candidatures', async ({
  page,
}) => {
  await page.goto('/comparer/?theme=fiscalite&c=philippe,melenchon&archives=0');
  await expect(page.locator('.comparison-card')).toHaveCount(2);
  await expect(page.locator('#comparison-theme-title')).toHaveText(
    'Fiscalité & budget',
  );
  await page.locator('#compare-theme').selectOption('climat');
  await expect(page).toHaveURL(/theme=climat/);
  await expect(page.locator('.comparison-card')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#compare-theme')).toHaveValue('climat');
  await page.locator('#compare-candidate-0').selectOption('asselineau');
  await page.getByRole('radio', { name: '3', exact: true }).check();
  await expect(page.locator('#compare-candidate-2')).toHaveValue('');
  await page.locator('#compare-candidate-2').selectOption('roussel');
  await expect(page.locator('.comparison-card')).toHaveCount(3);
  const names = await page.locator('.comparison-card h3').allTextContents();
  expect(new Set(names).size).toBe(3);
});
test('les paramètres non reconnus restent du texte sans exécution', async ({
  page,
}) => {
  await page.goto(
    '/comparer/?theme=%3Cimg%20src=x%20onerror=alert(1)%3E&c=philippe,philippe,inconnu',
  );
  await expect(page.locator('.comparison-card')).toHaveCount(0);
  await expect(page.locator('#comparison-theme-title')).toHaveText('Retraites');
  expect(await page.locator('img[src=x]').count()).toBe(0);
});
test('recherche locale et absence de requêtes vers des tiers', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(`${testOrigin}/`))
      external.push(request.url());
  });
  await page.goto('/recherche/');
  await page.getByRole('searchbox').fill('Philippe');
  await expect(
    page.locator('#search-results .advanced-result:visible').first(),
  ).toContainText('Philippe');
  await page.getByRole('searchbox').fill('aucunresultatpossible');
  await expect(page.locator('[role=status]')).toHaveText('0 résultat');
  expect(external).toEqual([]);
});
test('une erreur de chargement préserve la comparaison initiale', async ({
  page,
}) => {
  await page.route('**/api/corpus.json', (route) => route.abort());
  await page.goto('/comparer/');
  await expect(page.locator('#comparison-feedback')).toContainText(
    'n’a pas pu être chargé',
  );
  await expect(page.locator('.comparison-card')).toHaveCount(0);
});
test('la comparaison initiale reste accessible sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${testOrigin}/comparer/`);
  await expect(page.locator('.comparison-card')).toHaveCount(0);
  await expect(page.locator('noscript')).toBeVisible();
  await context.close();
});
