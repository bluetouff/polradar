import { testOrigin } from './origin';
import candidateRows from '../../src/data/candidates.json' with { type: 'json' };
import { pageSize } from '../../src/lib/pagination';
import { test, expect } from '@playwright/test';
import portraits from '../../src/data/portraits.json' with { type: 'json' };
import reviewed from '../../src/data/portraits-reviewed.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import positions from '../../src/data/divergence-positions.json' with { type: 'json' };

const active = candidateRows.filter((c) => !c.withdrawnOn);

test('la galerie conserve toutes les candidatures et explore les fiches par thème', async ({
  page,
}) => {
  await page.goto('/candidats/');
  await expect(page.locator('.candidate-gallery .person')).toHaveCount(
    active.length,
  );
  await expect(page.locator('.candidate-gallery img')).toHaveCount(
    portraits.filter((p) => active.some((c) => c.id === p.candidate)).length,
  );
  await page.locator('[data-candidate-theme]').selectOption('retraites');
  await expect(page).toHaveURL(/#theme=retraites/);
  await expect(page.locator('.person:visible')).toHaveCount(pageSize);
  await expect(page.locator('[data-candidate-status]')).toContainText(
    String(active.length) + ' candidatures',
  );
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
  await expect(page.locator('.person')).toHaveCount(active.length);
  await expect(page.locator('[data-candidate-controls]')).toBeHidden();
  await page.goto('/candidats/philippe/');
  await expect(page.locator('.candidate-hero img')).toBeVisible();
  await expect(page.locator('#theme-retraites')).toBeVisible();
  await page.goto('/credits-photos/#philippe');
  await expect(page.locator('#philippe')).toContainText('Jacques Paquier');
  await expect(page.locator('#philippe')).toContainText('CC BY 2.0');
  await page.goto('/candidats/mathieu/');
  await expect(page.locator('.candidate-hero img')).toBeVisible();
  const original = await page
    .locator('.candidate-hero img')
    .getAttribute('src');
  const response = await page.request.get(original!);
  expect(response.ok()).toBeTruthy();
  expect(
    createHash('sha256')
      .update(await response.body())
      .digest('hex'),
  ).toBe(
    reviewed.portraits.find((photo) => photo.candidate === 'mathieu')!
      .imageSha256,
  );
  await page.goto('/credits-photos/#mathieu');
  await expect(page.locator('#mathieu')).toContainText('Delphine Herbin');
  await expect(page.locator('#mathieu')).toContainText(
    'Autorisation de campagne',
  );
  await expect(page.locator('#mathieu')).toContainText(
    'toute autre modification est interdite',
  );
  await page.goto('/credits-photos/#glucksmann');
  await expect(page.locator('#glucksmann')).toContainText(
    'Union européenne 2024',
  );
  await expect(page.locator('#glucksmann')).not.toContainText('Xsolba');
  await context.close();
});

test('la carte distingue les conditions et conserve les chiffres lors des changements d’axe', async ({
  page,
}) => {
  await page.goto('/divergences/#retraites-age-depart');
  const age = page.locator('#retraites-age-depart');
  await expect(age).toBeVisible();
  await expect(age.locator('[data-divergence-point]')).toHaveCount(7);
  await expect(age).toContainText('62 ans et 9 mois');
  await expect(age.locator('[data-candidate="kazib"]')).toHaveAttribute(
    'data-value',
    '60',
  );
  await expect(age).toContainText('55 ans pour les métiers pénibles');
  const topics = page.getByRole('combobox', { name: 'Sujet à comparer' });
  await topics.selectOption('retraites-annuites');
  await expect(page).toHaveURL(/#retraites-annuites/);
  await expect(age).toBeHidden();
  await expect(
    page.locator('#retraites-annuites .divergence-record'),
  ).toHaveCount(3);
  await page.reload();
  await expect(page.locator('#retraites-annuites')).toBeVisible();
  await topics.selectOption('fiscalite-seuil-exoneration-heritage');
  await expect(
    page.locator('#fiscalite-seuil-exoneration-heritage'),
  ).toContainText('150 000');
  await page.goto('/divergences/#inconnu');
  const conditions = page.locator('#retraites-conditions-depart');
  await expect(conditions).toBeVisible();
  await expect(conditions.locator('[data-position-profile]')).toHaveCount(18);
  await expect(conditions).toContainText('Marine Le Pen');
  await expect(conditions).toContainText('Parti socialiste');
  await expect(conditions).toContainText('Olivier Becht');
  await expect(conditions).toContainText('Sébastien Bonnal');
  await expect(conditions).toContainText('Karim Bouamrane');
  await topics.selectOption('climat-prix-energie');
  const energy = page.locator('#climat-prix-energie');
  await expect(
    energy.getByRole('link', {
      name: 'Raphaël Glucksmann et Yannick Jadot',
      exact: true,
    }),
  ).toHaveAttribute('href', '/candidats/glucksmann/');
  const ps = energy.getByText('Parti socialiste', { exact: true });
  await expect(ps).toBeVisible();
  await expect(
    energy.getByRole('link', { name: /Étendre les tarifs réglementés/ }),
  ).toHaveAttribute('href', '/mesures/ps-climat-tarifs-reglementes/#version-1');
});

test('les nouveaux parcours restent lisibles à 320 pixels et ne chargent aucun tiers', async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(`${testOrigin}/`))
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
    const selection = page.getByRole('combobox', { name: 'Sujet à comparer' });
    for (const axis of [
      'retraites-age-depart',
      'retraites-annuites',
      'travail-smic-mensuel-net',
      'fiscalite-seuil-exoneration-heritage',
      'climat-nouveaux-epr2',
    ]) {
      await selection.selectOption(axis);
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

test('le menu mobile ouvre les rubriques au clavier et rend le focus à la fermeture', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/candidats/');
  const menu = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(menu.getByRole('link')).toHaveCount(4);
  const summary = page.locator('.site-directory summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  const tools = page.getByRole('navigation', { name: 'Rubriques et outils' });
  await expect(tools.getByRole('link', { name: 'Sondages' })).toBeVisible();
  await expect(tools.getByRole('link', { name: 'Candidats' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.keyboard.press('Tab');
  await expect(
    tools.getByRole('link', { name: 'Candidats', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(tools).toBeHidden();
  await expect(summary).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await summary.click();
  await tools.getByRole('link', { name: 'Toutes les rubriques' }).click();
  await expect(
    page.getByRole('heading', { name: 'Toutes les rubriques', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Chronologie', exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/campagne\//);
});

test('les cartes et leurs sources restent lisibles sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/divergences/');
  await expect(page.locator('.divergence-positions:visible')).toHaveCount(
    positions.length,
  );
  await expect(page.locator('.divergence-panel:visible')).toHaveCount(
    await page.locator('[data-axis-link]').count(),
  );
  await page
    .locator('[data-axis-link="institutions-ecrire-constitution"]')
    .click();
  await expect(page).toHaveURL(/#institutions-ecrire-constitution$/);
  await expect(page.locator('#institutions-ecrire-constitution')).toContainText(
    'Benoît Mathieu',
  );
  await expect(
    page.locator('.divergence-record .source-links a').first(),
  ).toBeVisible();
  await context.close();
});
