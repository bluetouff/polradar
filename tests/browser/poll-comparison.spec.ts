import { expect, test } from '@playwright/test';

test('les comparaisons se lisent sans JavaScript et partagent la révision des sondages', async ({
  browser,
  request,
}) => {
  const [build, report, corpus] = await Promise.all(
    ['/build.json', '/api/scenarios-sondages.json', '/api/corpus.json'].map(
      async (path) => {
        const response = await request.get(path);
        expect(response.ok()).toBe(true);
        return response.json();
      },
    ),
  );
  expect(report.sourceCommit).toBe(build.sourceCommit);
  expect(
    report.matrix
      .flatMap((row: { observations: string[] }) => row.observations)
      .sort(),
  ).toEqual(corpus.polls.map((p: { id: string }) => p.id).sort());
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 360, height: 760 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/sondages/comparer/');
    const group = page.locator('#philippe-retailleau');
    await expect(group.getByText('35,5 %', { exact: true })).toBeVisible();
    await expect(group.getByText('33,5 à 37 %', { exact: true })).toBeVisible();
    await group
      .getByText('Terrains, effectifs et notices', { exact: true })
      .press('Enter');
    await expect(
      group.getByRole('link', { name: 'Résultat, page 44' }),
    ).toHaveAttribute('href', /commission-des-sondages\.fr\/.*#page=44$/);
    await expect(page.getByText('Score incomplet')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});
