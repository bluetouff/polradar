import { test, expect } from '@playwright/test';
import { testOrigin } from './origin';

test('les deux chambres se parcourent sans JavaScript à 360 px', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 360, height: 780 },
  });
  const page = await ctx.newPage();
  try {
    await page.goto(testOrigin + '/votes/archives/');
    await page.getByRole('link', { name: 'Session 2022–2023' }).click();
    await expect(page.locator('.parl-card')).toHaveCount(30);
    await page.getByRole('link', { name: 'Page suivante' }).click();
    await expect(page).toHaveURL(/senat-2022\/2\/?#resultats/u);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.getByRole('link', { name: 'Toutes les périodes' }).click();
    await page.getByRole('link', { name: '12 mars 2024' }).click();
    await expect(
      page.getByText('Aucune position ni mise au point', { exact: false }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Toutes les périodes' }).click();
    await page.getByRole('link', { name: '21 octobre 2026' }).click();
    await expect(
      page
        .locator('.parl-card')
        .first()
        .getByRole('link', { name: 'Point du procès-verbal' }),
    ).toHaveAttribute(
      'href',
      'https://data.europarl.europa.eu/eli/dl/doc/PV-10-2026-10-21-RCV-ITM-136',
    );
  } finally {
    await ctx.close();
  }
});
