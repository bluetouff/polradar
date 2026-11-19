import { test, expect } from '@playwright/test';

test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 840 } });

test('les séries économiques et leurs valeurs restent lisibles sans JavaScript', async ({
  page,
  request,
}) => {
  await page.goto('/economie/');
  await expect(
    page.getByRole('heading', { name: 'Indicateurs économiques', level: 1 }),
  ).toBeVisible();
  await expect(page.locator('.economy-card')).toHaveCount(18);
  await page.getByRole('link', { name: 'Inflation harmonisée' }).click();
  await expect(
    page.getByRole('heading', { name: 'Inflation harmonisée', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: /^Inflation harmonisée/ }),
  ).toBeVisible();
  await page.getByText('Toutes les observations', { exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  const response = await request.get('/api/economie.json');
  expect(response.ok()).toBe(true);
  expect((await response.json()).series).toHaveLength(18);
  const downloading = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Données CSV' }).click();
  expect((await downloading).suggestedFilename()).toBe('polradar-economie.csv');
  const csv = await request.get('/api/economie-csv.txt');
  expect(csv.ok()).toBe(true);
  expect(await csv.text()).toContain('inflation;FR;M;2026-10;3.7;%;');
});

test('les déclarations distinguent concordance, révision et périmètre', async ({
  page,
}) => {
  await page.goto('/economie/declarations/');
  await expect(page.locator('#mercier-dette-2025')).toContainText(
    'Chiffre révisé',
  );
  await expect(
    page.locator('#mercier-dette-2025 .economy-values > div'),
  ).toHaveCount(3);
  await expect(
    page.locator('#attal-echanges-electriques-2025 .economy-values > div'),
  ).toHaveCount(2);
  await expect(page.locator('#farandou-chomage-t3-2026')).toContainText(
    'Concorde',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
