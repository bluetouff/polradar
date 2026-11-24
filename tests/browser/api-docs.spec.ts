import { testOrigin } from './origin';
import { test, expect } from '@playwright/test';

test('le guide agent et la description de l’API restent lisibles sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 780 },
  });
  const page = await context.newPage();
  try {
    await page.goto(`${testOrigin}/mcp/`);
    const guide = page.getByRole('link', {
      name: 'Guide de consultation pour les agents',
    });
    await guide.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/mcp\/documentation\/$/);
    await expect(page.locator('.dev-example pre')).toContainText(
      'polradar_search',
    );
    await expect(page.locator('.dev-example pre')).toContainText(
      'application/json, text/event-stream',
    );
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
    await page.getByRole('link', { name: 'API HTTP et exports JSON' }).click();
    await expect(
      page.getByRole('heading', { name: 'API publique de Polradar' }),
    ).toBeVisible();
    await page.setViewportSize({ width: 320, height: 850 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    const pathname = await page
      .getByRole('link', { name: 'Télécharger la spécification OpenAPI' })
      .getAttribute('href');
    const spec = await (
      await page.request.get(new URL(pathname!, page.url()).href)
    ).json();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.servers[0].url).toBe('https://polradar.fr/api/v1');
    await expect(page.locator('.dev-routes dt code')).toHaveText(
      Object.keys(spec.paths),
    );
    for (const path of Object.keys(spec.paths)) {
      expect(Object.keys(spec.paths[path]).sort()).toEqual([
        'get',
        'head',
        'parameters',
      ]);
    }
    expect(
      await (
        await page.request.get(new URL('/llms.txt', page.url()).href)
      ).text(),
    ).toContain('/api/openapi.json');
  } finally {
    await context.close();
  }
});
