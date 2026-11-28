import { expect, test } from '@playwright/test';

test('les accès mobiles restent disponibles après défilement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('link')).toHaveText([
    'Accueil',
    'Recherche',
    'Comparer',
    'Mon suivi',
  ]);
  await expect(nav.getByRole('link', { name: 'Accueil' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const dock = await nav.boundingBox();
  expect(dock).not.toBeNull();
  expect(dock!.height).toBeGreaterThanOrEqual(44);
  expect(dock!.y + dock!.height).toBeCloseTo(800, 0);
  const search = nav.getByRole('link', { name: 'Recherche' });
  await search.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/recherche\/$/);
  await expect(nav.getByRole('link', { name: 'Recherche' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('le nucléaire et la vérification des chiffres s’ouvrent depuis l’accueil', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/');
  const topics = page.getByRole('navigation', { name: 'Recherches suggérées' });
  await topics.getByRole('link', { name: 'Nucléaire' }).click();
  await expect(page.locator('#compare-question')).toHaveValue(
    'climat-production-nucleaire',
  );
  await expect(page.locator('#compare-candidate-0')).toHaveValue('');
  await expect(page.locator('#compare-candidate-1')).toHaveValue('');
  await page.goBack();
  const choices = page.getByRole('navigation', { name: 'Par où commencer' });
  await expect(choices.getByRole('link')).toHaveCount(6);
  await choices.getByRole('link', { name: 'Vérifier un chiffre' }).click();
  await expect(page).toHaveURL(/\/economie\/declarations\/$/);
  await expect(page.locator('main h1')).toBeVisible();
});

test('le calendrier reste lisible avec des caractères agrandis sur mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.evaluate(async () => {
    document.documentElement.style.setProperty(
      'font-size',
      '200%',
      'important',
    );
    await document.fonts.ready;
  });
  const calendar = page.locator('.cover-calendar');
  const overflow = await calendar
    .locator('a, dt, dd')
    .evaluateAll((items) =>
      items.some((item) => item.scrollWidth > item.clientWidth + 1),
    );
  expect(overflow).toBe(false);
  await expect(calendar.locator('time[datetime]')).toHaveCount(2);
  await expect(
    calendar.getByRole('link', { name: 'Calendrier électoral' }),
  ).toHaveAttribute('href', '/reperes/');
});

test('les sujets et les outils professionnels restent accessibles sans JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(new URL('/', baseURL).href);
    const topics = page.getByRole('navigation', {
      name: 'Recherches suggérées',
    });
    await topics.getByRole('link', { name: 'Retraites' }).click();
    await expect(page).toHaveURL(/\/themes\/retraites\/$/);
    const disclosure = page.locator('.site-directory summary');
    await disclosure.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('navigation', { name: 'Rubriques et outils' });
    await panel
      .locator('.directory-picker label')
      .filter({ hasText: 'Programmes' })
      .click();
    await expect(
      panel.getByRole('link', { name: 'Propositions', exact: true }),
    ).toBeVisible();
    await panel
      .locator('.directory-picker label')
      .filter({ hasText: 'Outils pro' })
      .click();
    await panel
      .getByRole('link', { name: 'Données et outils professionnels' })
      .click();
    await expect(page).toHaveURL(/\/rubriques\/#professionnels$/);
    await expect(
      page
        .locator('#professionnels')
        .getByRole('link', { name: 'API publique' }),
    ).toHaveAttribute('href', '/api/');
  } finally {
    await context.close();
  }
});

test('le menu Explorer donne accès aux liens du pied de page sans répéter la barre principale', async ({
  page,
}) => {
  for (const [width, height] of [
    [320, 568],
    [320, 740],
    [390, 844],
    [820, 720],
    [1280, 720],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const summary = page.locator('.site-directory summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('navigation', { name: 'Rubriques et outils' });
    const hrefs = (selector: string) =>
      page
        .locator(selector)
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    const primary = await hrefs('.site-navigation a:visible');
    const exploreLinks = () => hrefs('.site-directory nav a:visible');
    const checkPanelHeight = async () => {
      const category = await panel
        .locator('input:checked')
        .getAttribute('value');
      const message = `Menu à ${width} × ${height} (${category})`;
      const overflows = await panel.evaluate(
        (el) => el.scrollHeight > el.clientHeight + 1,
      );
      expect(overflows, message).toBe(false);
      const bounds = (await panel.boundingBox())!;
      const bottomBar =
        width <= 760
          ? await page
              .getByRole('navigation', { name: 'Navigation principale' })
              .boundingBox()
          : null;
      expect(bounds.y + bounds.height, message).toBeLessThanOrEqual(
        bottomBar?.y ?? height,
      );
    };
    const explorer = new Set(await exploreLinks());
    await checkPanelHeight();
    if (await panel.locator('.directory-picker').isVisible()) {
      for (const category of await panel
        .locator('.directory-picker label:visible')
        .all()) {
        await category.click();
        await checkPanelHeight();
        const links = await exploreLinks();
        expect(new Set(links).size).toBe(links.length);
        links.forEach((link) => explorer.add(link));
      }
    } else {
      expect(explorer.size).toBe((await exploreLinks()).length);
    }
    const footer = await hrefs('.footer-columns a');
    expect([...explorer].filter((link) => primary.includes(link))).toEqual([]);
    expect(
      footer.filter((link) => !primary.includes(link) && !explorer.has(link)),
    ).toEqual([]);
    for (const path of [
      '/studio/',
      '/api/',
      '/mcp/',
      '/financements/',
      '/sondages/notices/',
    ])
      expect(explorer.has(path)).toBe(true);
    const bounds = await panel.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    await expect(summary).toBeFocused();
    await expect(panel).toBeHidden();
  }
});
