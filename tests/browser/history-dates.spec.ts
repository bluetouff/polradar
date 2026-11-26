import { expect, test } from '@playwright/test';
import versions from '../../src/data/versions.json' with { type: 'json' };

const measure = 'philippe-retraites-2';
const historical = versions.filter((version) => version.measureId === measure);
const archived = 'cdaae3bff0fd82a0676242b6123c8b93f0c47aa9';

test('une comparaison par date conserve ses valeurs, sa révision et ses liens à 390 px', async ({
  page,
  request,
}) => {
  const response = await request.get('/build.json');
  const { sourceCommit } = await response.json();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/mesures/${measure}/`);
  await page.getByRole('link', { name: 'Comparer à deux dates ↗' }).click();
  await expect(page.getByLabel('Comparer par')).toHaveValue('dates');
  await page.getByLabel('Première date').fill('2026-11-17');
  await page.getByLabel('Deuxième date').fill('2026-11-26');
  const compare = page.getByRole('button', { name: 'Comparer', exact: true });
  await compare.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#history-status')).toContainText(
    'versions 3 et 4',
  );
  const diff = page.locator('.diff-field').filter({
    has: page.getByRole('heading', { name: 'Proposition', exact: true }),
  });
  await expect(diff.locator('.diff-before')).toHaveText(
    historical[2].snapshot.description,
  );
  await expect(diff.locator('.diff-after')).toHaveText(
    historical[3].snapshot.description,
  );
  await expect(
    page.getByRole('link', { name: 'Voir la version 4 ↗' }),
  ).toHaveAttribute('href', `/mesures/${measure}/#version-4`);
  await expect(
    page.getByRole('link', { name: /^Archive de l’édition/ }),
  ).toHaveAttribute(
    'href',
    new RegExp(`site-${sourceCommit}/corpus-v1.tar.gz$`),
  );
  expect(new URL(page.url()).searchParams.get('revision')).toBe(sourceCommit);
  await page.reload();
  await expect(page.locator('#history-status')).toContainText(
    'versions 3 et 4',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole('link', { name: 'Voir la version 4 ↗' }).click();
  await expect(page.locator('#version-4')).toContainText('Correction');
});

test('une date antérieure au premier enregistrement ne récupère aucune version non datée', async ({
  page,
}) => {
  await page.goto(
    `/historique/?mesure=${measure}&mode=dates&dateAvant=2026-11-16&dateApres=2026-11-17`,
  );
  const result = page.locator('#history-result');
  await expect(
    result.getByText('Aucune version datée à cette date dans cette édition.'),
  ).toBeVisible();
  await expect(
    result.getByText('Date d’enregistrement inconnue pour 1 version.'),
  ).toBeVisible();
  await expect(result.locator('.version-pill')).toHaveText(['V3']);
  await expect(page.locator('#history-status')).toContainText(
    'comparaison reste incomplète',
  );
});

test('une URL rattachée à une ancienne révision mène à l’archive exacte', async ({
  page,
}) => {
  await page.goto(
    `/historique/?mesure=${measure}&mode=dates&dateAvant=2026-11-17&dateApres=2026-11-26&revision=${archived}`,
  );
  await expect(page.locator('#history-status')).toContainText(
    'L’édition demandée diffère',
  );
  await expect(
    page.getByRole('link', { name: /^Archive de l’édition/ }),
  ).toHaveAttribute(
    'href',
    `https://github.com/bluetouff/polradar/releases/download/site-${archived}/corpus-v1.tar.gz`,
  );
  await expect(page.locator('.version-pill')).toHaveCount(0);
  await page.getByRole('button', { name: 'Comparer', exact: true }).click();
  await expect(page.locator('#history-status')).toContainText(
    'versions 3 et 4',
  );
  await page.goto(
    `/historique/?mode=dates&dateAvant=2026-11-17&dateApres=2026-11-26&revision=${archived}`,
  );
  await expect(
    page.getByRole('link', { name: /^Archive de l’édition/ }),
  ).toHaveAttribute('href', new RegExp(`site-${archived}/corpus-v1.tar.gz$`));
});

test('l’historique conserve son journal si l’export ne correspond pas à la page', async ({
  page,
}) => {
  await page.route('**/api/corpus.json', (route) =>
    route.fulfill({ json: { versions: [] } }),
  );
  await page.goto(`/historique/?mesure=${measure}&mode=dates`);
  await expect(page.locator('#history-status')).toContainText(
    'La comparaison des versions n’a pas pu être chargée',
  );
  await expect(page.locator('#history-form')).toBeHidden();
  await expect(
    page.getByRole('heading', { name: 'Dernières modifications éditoriales' }),
  ).toBeVisible();
});

test('le journal historique reste accessible sans JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    viewport: { width: 320, height: 700 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/historique/');
    await expect(page.locator('#history-form')).toBeHidden();
    await expect(
      page.getByRole('heading', {
        name: 'Dernières modifications éditoriales',
      }),
    ).toBeVisible();
    await expect(page.locator('.version-timeline a').first()).toBeVisible();
  } finally {
    await context.close();
  }
});
