import { expect, test } from '@playwright/test';
import { testOrigin } from './origin';

test('scrutins nominatifs, requête locale et lien officiel', async ({
  page,
}) => {
  const datasets: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/parlement/assemblee.json'))
      datasets.push(r.url());
  });
  await page.goto('/votes/registre/');
  await expect(
    page.getByRole('combobox', { name: 'Député', exact: true }),
  ).toHaveValue('');
  await expect(page.locator('[data-parl-static] article')).toHaveCount(30);
  expect(datasets).toHaveLength(0);
  await page
    .getByRole('combobox', { name: 'Député', exact: true })
    .selectOption('lepen');
  await page
    .getByRole('combobox', { name: 'Législature', exact: true })
    .selectOption('16');
  await page.getByLabel('Objet ou numéro du scrutin').fill('3213');
  await page.getByRole('button', { name: 'Rechercher' }).click();
  const article = page.locator('[data-parl-filtered] article').filter({
    has: page.getByRole('link', { name: 'Scrutin officiel n° 3213 ↗' }),
  });
  await expect(article).toContainText('Marine Le Pen');
  await expect(article).toContainText('349 pour');
  await expect(article).toContainText('186 contre');
  await expect(article).toContainText('38 abstentions');
  await expect(article.getByRole('link')).toHaveAttribute(
    'href',
    'https://www.assemblee-nationale.fr/dyn/16/scrutins/3213',
  );
  expect(datasets).toHaveLength(1);
  await page.getByLabel('Objet ou numéro du scrutin').fill('abcdefghijkxz');
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Aucun scrutin pour cette recherche.',
  );
  expect(datasets).toHaveLength(1);
  await page.getByRole('button', { name: 'Effacer' }).click();
  await expect(page.locator('[data-parl-static]')).toBeVisible();
});
test('pages chronologiques utilisables sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(testOrigin + '/votes/');
    await page
      .getByRole('link', { name: 'Registre des scrutins de l’Assemblée' })
      .click();
    const first = await page.locator('.parl-card h2').first().textContent();
    await page.getByRole('link', { name: 'Page suivante' }).click();
    await expect(page).toHaveURL(/\/votes\/registre\/2\/?#resultats$/u);
    await expect(page.locator('.parl-card')).toHaveCount(30);
    await expect(page.locator('.parl-card h2').first()).not.toHaveText(first!);
  } finally {
    await context.close();
  }
});
