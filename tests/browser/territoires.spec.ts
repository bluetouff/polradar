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
test('les valeurs des indicateurs communaux conservent leur unité et leur libellé sur une ligne', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/territoires/');
  const labels = page.locator('[data-facts] dd');
  const heights = await labels.evaluateAll((values) =>
    values
      .slice(0, 5)
      .map(
        (value) =>
          value.getBoundingClientRect().height /
          parseFloat(getComputedStyle(value).lineHeight),
      ),
  );
  expect(Math.max(...heights)).toBeLessThanOrEqual(1.05);
});
test('la carte départementale affiche la valeur, le palier et les données hors champ sur mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(health);
  const selector = page.getByRole('combobox', {
    name: 'Consulter un département',
  });
  const result = page.locator('#department-value');
  const activeBand = result.locator('.terrain-map-scale .is-active');
  await selector.selectOption('28');
  await expect(result.getByText('2,36', { exact: true })).toBeVisible();
  await expect(
    result.getByText('Accès faible · moins de 3', { exact: true }),
  ).toBeVisible();
  await expect(activeBand).toHaveText('< 3');
  expect((await result.boundingBox())!.y).toBeLessThan(
    (await page.locator('.terrain-map figure').boundingBox())!.y,
  );
  await selector.selectOption('974');
  await expect(result.getByText('5,44', { exact: true })).toBeVisible();
  await expect(
    result.getByText('Accès élevé · 5 ou plus', { exact: true }),
  ).toBeVisible();
  await expect(activeBand).toHaveText('≥ 5');
  await expect(page.locator('.terrain-map .selected-area')).toHaveAttribute(
    'id',
    'apl-dep-974',
  );
  await selector.selectOption('976');
  await expect(
    result.getByText('Hors du champ', { exact: false }),
  ).toBeVisible();
  await expect(result.locator('.terrain-map-scale')).toBeHidden();
  await selector.selectOption('');
  await expect(page.locator('.terrain-map .selected-area')).toHaveCount(0);
  await expect(result.locator('.terrain-map-value:visible')).toHaveCount(0);
});
test('la recherche communale actualise le chiffre et son palier sans débordement à 320 × 568', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(health);
  const lookup = page.locator('[data-territory="apl"]');
  const result = lookup.locator('[data-apl-result]');
  const score = result.locator('[data-apl-number]');
  const category = result.locator('[data-apl-class]');
  await expect(score).toHaveText('5,50');
  await expect(category).toHaveText('Accès élevé · 5 ou plus');
  await expect(lookup.locator('[data-apl-territory]')).toContainText(
    'Moyenne des arrondissements',
  );
  const input = page.getByRole('searchbox', {
    name: 'Nom de commune ou code Insee',
  });
  const find = async (code: string) => {
    await input.fill(code);
    await input.press('Enter');
    await expect(page).toHaveURL(new RegExp('#commune=' + code + '$'));
  };
  await find('28085');
  await expect(lookup.locator('[data-place]')).toContainText('Chartres');
  await expect(score).toHaveText('2,53');
  await expect(category).toHaveText('Accès faible · moins de 3');
  await expect(result.locator('.terrain-map-reference')).toHaveText(
    'Moyenne nationale en 2024 3,3',
  );
  await lookup.evaluate((element) =>
    element.scrollIntoView({ block: 'start' }),
  );
  expect(
    (await result.boundingBox())!.y + (await result.boundingBox())!.height,
  ).toBeLessThanOrEqual(
    (await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .boundingBox())!.y,
  );
  await find('10255');
  await expect(score).toHaveText('2,995');
  await expect(category).toHaveText('Accès faible · moins de 3');
  await find('01019');
  await expect(score).toHaveText('0,00');
  await expect(category).toHaveText('Accès faible · moins de 3');
  await find('97611');
  await expect(lookup.locator('[data-apl-unavailable]')).toBeVisible();
  await expect(result).toBeHidden();
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
    await expect(page.locator('.terrain-map figure > svg')).toBeVisible();
    await expect(page.locator('table tbody tr')).toHaveCount(101);
    await expect(
      page.locator('[data-territory="apl"] [data-apl-number]'),
    ).toHaveText('5,50');
    await page.goto('/questions/fiscalite-csg-salaires/');
    await expect(
      page.getByText('180,78', { exact: false }).first(),
    ).toBeVisible();
    await expect(page.locator('#integrer summary').first()).toBeVisible();
  } finally {
    await context.close();
  }
});
