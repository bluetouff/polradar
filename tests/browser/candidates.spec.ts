import { test, expect } from '@playwright/test';

test('la galerie conserve toutes les candidatures et explore les fiches par thème', async ({
  page,
}) => {
  await page.goto('/candidats/');
  await expect(page.locator('.candidate-gallery .person')).toHaveCount(33);
  await expect(page.locator('.candidate-gallery img')).toHaveCount(23);
  await page.locator('[data-candidate-theme]').selectOption('retraites');
  await expect(page).toHaveURL(/#theme=retraites/);
  await expect(page.locator('.person:visible')).toHaveCount(33);
  await expect(
    page.locator('.person[data-search^="Anasse"] [data-person-count]'),
  ).toContainText('1 fiche');
  await expect(
    page.locator('.person[data-search^="Anasse"] a'),
  ).toHaveAttribute('href', '/candidats/kazib/#theme-retraites');
  await page.locator('[data-candidate-query]').fill('Edouard Philippe');
  await expect(page.locator('.person:visible')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-candidate-query]')).toHaveValue(
    'Edouard Philippe',
  );
  await expect(page.locator('[data-candidate-theme]')).toHaveValue('retraites');
  await page.locator('[data-candidate-query]').fill('aucunresultatpossible');
  await expect(page.locator('[data-candidate-status]')).toContainText(
    '0 candidature',
  );
});

test('les portraits, crédits et fiches restent disponibles sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/candidats/');
  await expect(page.locator('.person')).toHaveCount(33);
  await expect(page.locator('[data-candidate-controls]')).toBeHidden();
  await page.goto('/candidats/philippe/');
  await expect(page.locator('.candidate-hero img')).toBeVisible();
  await expect(page.locator('#theme-retraites')).toBeVisible();
  await page.goto('/credits-photos/#philippe');
  await expect(page.locator('#philippe')).toContainText('CC0');
  await context.close();
});

test('la carte distingue les conditions et conserve les chiffres lors des changements d’axe', async ({
  page,
}) => {
  await page.goto('/divergences/');
  const age = page.locator('#retraites-age-depart');
  await expect(age).toBeVisible();
  await expect(age.locator('[data-divergence-point]')).toHaveCount(4);
  await expect(age.locator('[data-candidate="kazib"]')).toHaveAttribute(
    'data-value',
    '60',
  );
  await expect(age).toContainText('55 ans pour les métiers pénibles');
  await page.locator('[data-axis-link="retraites-annuites"]').click();
  await expect(page).toHaveURL(/#retraites-annuites/);
  await expect(age).toBeHidden();
  await expect(
    page.locator('#retraites-annuites .divergence-record'),
  ).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#retraites-annuites')).toBeVisible();
  await page
    .locator('[data-axis-link="fiscalite-seuil-exoneration-heritage"]')
    .click();
  await expect(
    page.locator('#fiscalite-seuil-exoneration-heritage'),
  ).toContainText('150 000');
  await page.goto('/divergences/#inconnu');
  await expect(age).toBeVisible();
});

test('les nouveaux parcours restent lisibles à 320 pixels et ne chargent aucun tiers', async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4321/'))
      external.push(request.url());
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/candidats/',
      '/candidats/kazib/',
      '/divergences/',
      '/credits-photos/',
    ]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        `${path} at ${width}`,
      ).toBe(false);
    }
    await page.goto('/divergences/');
    for (const axis of [
      'retraites-age-depart',
      'retraites-annuites',
      'travail-smic-mensuel-net',
      'fiscalite-seuil-exoneration-heritage',
    ]) {
      await page.locator(`[data-axis-link="${axis}"]`).click();
      await page.evaluate(() => document.fonts.ready);
      const outside = await page
        .locator(`#${axis} .divergence-svg`)
        .evaluate((chart) => {
          const svg = chart as SVGSVGElement,
            box = svg.viewBox.baseVal;
          return [
            ...svg.querySelectorAll<SVGGraphicsElement>(
              '[data-halo],[data-point-value],[data-axis-ticks] text',
            ),
          ].some((node) => {
            const b = node.getBBox();
            return (
              b.x < -1 ||
              b.y < -1 ||
              b.x + b.width > box.width + 1 ||
              b.y + b.height > box.height + 1
            );
          });
        });
      expect(outside, `${axis} at ${width}`).toBe(false);
    }
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('le menu compact donne accès aux autres rubriques sur mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/candidats/');
  await page.locator('.mobile-navigation summary').click();
  await expect(page.locator('.mobile-navigation nav')).toBeVisible();
  const link = page.locator('.mobile-navigation a[href="/campagne/"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/campagne\//);
});

test('les quatre cartes et leurs sources restent lisibles sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/divergences/');
  await expect(page.locator('.divergence-panel:visible')).toHaveCount(4);
  await expect(
    page.locator('.divergence-record .source-links a').first(),
  ).toBeVisible();
  await context.close();
});
