import { test, expect } from '@playwright/test';

test('les dépôts et les rôles sénatoriaux se consultent sans JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 320, height: 850 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/votes/archives/');
    await page
      .getByRole('link', {
        name: 'Consulter aussi les textes et rapports du Sénat',
      })
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Textes et rapports du Sénat',
    );
    await page.getByRole('link', { name: 'Rapports et avis' }).click();
    const report = page.locator('article').filter({
      has: page.getByRole('heading', {
        name: "La neutralité de l'Internet",
        exact: true,
      }),
    });
    await expect(report).toContainText('Bruno Retailleau');
    await expect(report).toContainText('signataire');
    await expect(
      report.getByRole('link', { name: 'Document du Sénat n° 302' }),
    ).toHaveAttribute('href', 'https://www.senat.fr/rap/r10-302/r10-302.html');
    await page.getByRole('link', { name: 'Tous les documents' }).click();
    await page.getByRole('link', { name: 'Propositions de loi' }).click();
    await page.getByRole('link', { name: 'Page suivante' }).click();
    await expect(page).toHaveURL(
      /\/votes\/textes-senat\/propositions-de-loi\/2\/#documents$/,
    );
    await expect(page.locator('#documents article')).toHaveCount(24);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    const response = await page.request.get('/api/parlement/textes-senat.json');
    expect(response.ok()).toBe(true);
    expect((await response.json()).documents).toHaveLength(334);
  } finally {
    await context.close();
  }
});
