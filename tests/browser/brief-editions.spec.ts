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
