import { expect, test } from '@playwright/test';
const housing = '/questions/logement-obligations-parc-social/';
const health = '/questions/sante-installation-medecins/';
test('la recherche SRU affiche le statut et exporte la commune effectivement sélectionnée', async ({
  page,
}) => {
  await page.goto(housing);
  await expect(page.locator('[data-facts]')).toContainText('23,21 %');
  const input = page.getByRole('searchbox', {
    name: 'Nom de commune ou code Insee',
  });
  await input.fill('97120');
  await input.press('Enter');
  await expect(page).toHaveURL(/#commune=97120$/);
  await expect(page.locator('[data-facts]')).toContainText('121,87 %');
  const code = await page.locator('#territory-embed').inputValue();
  const image = Buffer.from(
    code.match(/base64,([^"]+)/)![1],
    'base64',
  ).toString();
  expect(image).toContain('Pointe-à-Pitre');
  expect(image).toContain('125 %');
  expect(image).not.toContain('<script');
  await expect(page.locator('[data-download]')).toHaveAttribute(
    'download',
    'polradar-sru-97120.svg',
  );
  await input.fill('01001');
  await input.press('Enter');
  await expect(page.locator('[data-facts]')).toContainText(
    'absente du fichier',
  );
  await expect(page.locator('[data-local-figure]')).toBeHidden();
  await page.goto(housing + '#commune=59002');
  await expect(page.locator('[data-facts]')).toContainText('Plus de 25 %');
  await expect(page.locator('[data-facts]')).toContainText(
    'Inventaire non disponible',
  );
});
test('la carte, les valeurs absentes et les zéros restent lisibles sur mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(health + '#commune=97611');
  await expect(page.locator('[data-facts]')).toContainText(
    'Aucune observation',
  );
  await page.locator('#territory-department').selectOption('01');
  await expect(page.locator('#department-value')).toContainText('2,57');
  await page.locator('#territory-department').selectOption('976');
  await expect(page.locator('#department-value')).toContainText(
    'Hors du champ',
  );
  const input = page.getByRole('searchbox', {
    name: 'Nom de commune ou code Insee',
  });
  await input.fill('01019');
  await input.press('Enter');
  await expect(page.locator('[data-facts]')).toContainText('0,00');
  await expect(page.locator('.q-answers')).toContainText(
    'agence régionale de santé',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
test('les exemples, la carte et les liens vers les fichiers restent disponibles sans JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto(housing);
    await expect(page.locator('[data-facts]')).toContainText('276');
    await expect(
      page.getByRole('link', { name: /Consulter toutes les communes/ }),
    ).toBeVisible();
    await page.goto(health);
    await expect(page.locator('.terrain-map svg').first()).toBeVisible();
    await expect(page.locator('table tbody tr')).toHaveCount(101);
    await page.goto('/questions/fiscalite-csg-salaires/');
    await expect(
      page.getByText('180,78', { exact: false }).first(),
    ).toBeVisible();
    await expect(page.locator('#integrer summary').first()).toBeVisible();
  } finally {
    await context.close();
  }
});
