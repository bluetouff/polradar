import { expect, test } from '@playwright/test';

const id = 'philippot-europe-organisations';

test('la signature du parti reste visible du filtre au document, au partage et au flux', async ({
  page,
  request,
}) => {
  await page.goto('/mesures/#candidate=philippot&q=CEDH');
  const card = page
    .locator('.measure-row')
    .filter({ has: page.locator(`a[href="/mesures/${id}/"]`) });
  await expect(card).toHaveCount(1);
  await expect(card.locator('.measure-meta strong')).toHaveText(
    'Les Patriotes',
  );
  await card.locator(`a[href="/mesures/${id}/"]`).click();
  await expect(page).toHaveTitle(/Les Patriotes/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    /Les Patriotes/,
  );
  await expect(
    page.getByRole('link', {
      name: 'Dossier de Florian Philippot',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.precise-sources')).toContainText(
    'Auteur du document · Les Patriotes',
  );
  const records = await (await request.get('/api/recherche.json')).json();
  expect(
    records.find((r: { id: string }) => r.id === 'mesure-' + id),
  ).toMatchObject({ author: 'Les Patriotes', candidate: 'philippot' });
  const corpus = await (await request.get('/api/corpus.json')).json();
  expect(
    corpus.measures.find((r: { id: string }) => r.id === id).displayAuthor,
  ).toBe('Les Patriotes');
  expect(corpus.documentAuthors['patriotes-projet-2026-2027'].author).toBe(
    'Les Patriotes',
  );
  const feed = await (await request.get('/rss/candidats/philippot.xml')).text();
  expect(feed).toMatch(/<title>[^<]*Les Patriotes · Quitter l’OTAN/);
});

test('une source ancienne garde sa date et l’attribution incertaine reste visible sans JavaScript', async ({
  browser,
  baseURL,
}) => {
  const page = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 700 },
  });
  try {
    await page.goto(
      new URL(
        '/mesures/dupont-aignan-education-formation-metiers-numeriques/',
        baseURL,
      ).href,
    );
    await expect(page.locator('.measure-meta')).toContainText(
      'Document de parti',
    );
    await expect(page.locator('.precise-sources')).toContainText(
      '15 septembre 2022',
    );
    await expect(page.locator('.precise-sources')).toContainText(
      '5 février 2024',
    );
    await expect(page.locator('header.page-title a')).toHaveAccessibleName(
      /Dossier de Nicolas Dupont-Aignan/,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  } finally {
    await page.close();
  }
});
