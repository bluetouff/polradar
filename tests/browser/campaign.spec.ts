import { test, expect } from '@playwright/test';

test('la chronologie combine les filtres, gère une recherche vide et se réinitialise', async ({
  page,
}) => {
  await page.goto('/campagne/');
  await expect(page.locator('#campaign-status')).toContainText('26 événements');
  await page.locator('#campaign-category').selectOption('programme');
  await page.locator('#campaign-candidate').selectOption('ruffin');
  await expect(page.locator('.campaign-entry:visible')).toHaveCount(4);
  await expect(page.locator('.campaign-month:visible')).toHaveCount(2);
  await page.locator('#campaign-search').fill('école');
  await expect(page.locator('.campaign-entry:visible')).toHaveCount(1);
  await expect(page.locator('.campaign-entry:visible')).toContainText('28');
  await page.locator('#campaign-search').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#campaign-empty')).toBeVisible();
  expect(await page.locator('img[src=x]').count()).toBe(0);
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await expect(page.locator('.campaign-entry:visible')).toHaveCount(26);
  await expect(page.locator('#campaign-empty')).toBeHidden();
});

test('la chronologie et les sources restent accessibles sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/campagne/');
  await expect(page.locator('.campaign-entry')).toHaveCount(26);
  await expect(page.locator('#campaign-filters')).toBeHidden();
  await expect(page.locator('#branco-declaration')).toContainText(
    'Juan Branco',
  );
  await expect(
    page.locator('#ruffin-jeunesse-publication .source-links a'),
  ).toHaveAttribute(
    'href',
    'https://nouspresident.fr/redonner-aux-jeunes-les-clefs-de-leur-avenir/',
  );
  await context.close();
});

test('la home conserve ses graphiques en haut et ses dossiers sous les thèmes', async ({
  page,
}) => {
  for (const width of [768, 1024, 1440, 1800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const programme = (await page.locator('.programme-index').boundingBox())!;
    const dossiers = (await page.locator('.home-dossiers').boundingBox())!;
    const poll = (await page.locator('.home-poll').boundingBox())!;
    expect(dossiers.y - programme.y - programme.height).toBeLessThanOrEqual(32);
    expect(Math.abs(poll.y - programme.y)).toBeLessThanOrEqual(1);
    await expect(page.locator('.candidate-roster a')).toHaveCount(33);
    await expect(page.locator('.home-market-provider')).toHaveCount(2);
  }
});

test('le titre des courbes conserve un padding au-dessus et en dessous', async ({
  page,
}) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sondages/#enquete=elabe-2026-11-14-philippe');
    const heading = page.locator('.poll-trend > .register-heading');
    const padding = await heading.evaluate((node) => {
      const style = getComputedStyle(node);
      return [parseFloat(style.paddingTop), parseFloat(style.paddingBottom)];
    });
    expect(Math.min(...padding)).toBeGreaterThanOrEqual(14);
  }
});

test('les icônes et les compteurs de thèmes gardent leur taille et leur alignement', async ({
  page,
}) => {
  for (const width of [320, 390, 768, 901, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const brand = (await page.locator('.wordmark').boundingBox())!;
    const caption = (await page.locator('.rail-brand > p').boundingBox())!;
    expect(
      caption.x >= brand.x + brand.width + 8 ||
        caption.y >= brand.y + brand.height + 8,
      `signature à ${width}px`,
    ).toBe(true);
    for (const link of await page.locator('.theme-register > a').all()) {
      const icon = (await link.locator(':scope > .icon').boundingBox())!;
      const count = (await link.locator('.theme-count').boundingBox())!;
      const bar = (await link.locator('.theme-entry svg').boundingBox())!;
      expect(icon.width, `icône à ${width}px`).toBeGreaterThanOrEqual(29);
      expect(
        Math.abs(icon.y + icon.height / 2 - count.y - count.height / 2),
        `alignement à ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(bar.width, `barre à ${width}px`).toBeGreaterThanOrEqual(20);
    }
  }
});
