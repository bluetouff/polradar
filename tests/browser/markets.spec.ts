import { test, expect } from '@playwright/test';

test('les deux plateformes se consultent sans appel externe et la recherche reste inerte', async ({
  page,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4321/'))
      external.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/marches-predictifs/');
  await expect(page.locator('.market-board:visible')).toHaveCount(2);
  await expect(page.locator('#market-filters')).toBeVisible();
  await page.locator('#market-search').fill('Le Pen');
  await expect(page.locator('.market-row:visible')).toHaveCount(2);
  await page.locator('#market-provider').selectOption('kalshi');
  await expect(page.locator('.market-board:visible')).toHaveCount(1);
  await expect(page.locator('.market-row:visible')).toHaveCount(1);
  await page.locator('.market-row:visible summary').click();
  await expect(page.locator('.market-contract[open]')).toContainText('wins');
  await page.locator('#market-search').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#market-status')).toHaveText(
    '0 contrat correspondant',
  );
  await expect(page.locator('img[src=x]')).toHaveCount(0);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('les prix et les règles restent consultables sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/marches-predictifs/');
  await expect(page.locator('.market-board')).toHaveCount(2);
  await expect(page.locator('#market-filters')).toBeHidden();
  await expect(page.locator('.market-row:visible')).toHaveCount(20);
  await page
    .locator('.market-board')
    .first()
    .locator('.market-more > summary')
    .click();
  expect(await page.locator('.market-row:visible').count()).toBeGreaterThan(20);
  await context.close();
});

test('les instituts et les références distinctes des résultats sont accessibles', async ({
  page,
}) => {
  await page.goto('/sondages/');
  await expect(page.locator('#poll-institute option')).toHaveCount(8);
  for (const institute of [
    'Ifop',
    'Ipsos BVA',
    'Cluster17',
    'OpinionWay',
    'Toluna Harris Interactive',
    'Odoxa',
  ]) {
    await page.locator('#poll-institute').selectOption(institute);
    await expect(page.locator('#poll-status')).toContainText(institute);
    await expect(
      page.locator('#poll-bars .poll-bar-row').first(),
    ).toBeVisible();
  }
  await expect(page.locator('#poll-method')).toContainText('12 005 personnes');
  await expect(
    page
      .locator('#poll-method a')
      .filter({ hasText: 'Résultats de l’institut' }),
  ).toHaveAttribute('href', /\.pdf#page=12$/);
});
