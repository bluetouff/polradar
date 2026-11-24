import { expect, test } from '@playwright/test';
test('une reprise du 24 conserve sa date de publication et la date de sa source', async ({
  page,
}) => {
  await page.goto('/breves/edition/2026-11-24/');
  const link = page.locator(
    '.brief-cards a[href="/breves/veille-233537b15f326bfe3e32/"]',
  );
  await expect(link.locator('time')).toHaveAttribute('datetime', '2026-11-24');
  await link.click();
  await expect(page.locator('[itemprop="datePublished"]')).toHaveAttribute(
    'datetime',
    '2026-11-24',
  );
  await expect(page.locator('.brief-links')).toContainText('23 novembre 2026');
  await expect(page.locator('.article-sources a').first()).toBeVisible();
});

test.describe('relevés du 24 novembre', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  test('la revue complète et les annonces affichent séparément leurs sources', async ({
    page,
  }) => {
    await page.goto('/breves/edition/2026-11-24/#edition-checks');
    const region = page.getByRole('region', {
      name: 'Vérification des sources',
    });
    const complete = region
      .locator('article')
      .filter({
        has: page.getByRole('heading', { name: 'Revue éditoriale complète' }),
      })
      .first();
    const priority = region
      .locator('article')
      .filter({
        has: page.getByRole('heading', {
          name: 'Annonces officielles prioritaires',
        }),
      })
      .first();
    await expect(complete).toContainText('65 sur 72');
    await expect(priority).toContainText('8 sur 9');
    await expect(complete.locator('time')).toHaveAttribute(
      'datetime',
      '2026-11-24T03:10:42.101Z',
    );
    await expect(priority.locator('time')).toHaveAttribute(
      'datetime',
      '2026-11-24T18:02:09.181Z',
    );
    await priority
      .locator('summary')
      .filter({ hasText: 'Incidents' })
      .press('Enter', { timeout: 4000 });
    await expect(
      priority.locator('details').first().locator('li').first(),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  });
});
