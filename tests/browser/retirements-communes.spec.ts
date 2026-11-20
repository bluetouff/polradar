import { test, expect } from '@playwright/test';

test('le comparatif affiche chaque génération sans script et télécharge son graphique', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  await page.goto(new URL('/comparer/', baseURL).href);
  await page
    .getByRole('link', { name: /Ce qui changerait · Retraites/ })
    .click();
  await expect(page.locator('#retirement-depart + p')).toHaveText(
    'Âge légal actuel et âges annoncés',
  );
  await expect(page.locator('.retirement-row-0').first()).toContainText(
    '64 ans',
  );
  await page.getByRole('link', { name: 'Janv. 1963 à mars 1965' }).click();
  await expect(page).toHaveURL(/1963-mars-1965\/$/);
  await expect(page.locator('.retirement-row-0').first()).toContainText(
    '62 ans et 9 mois',
  );
  await expect(page.locator('.retirement-row-0').nth(1)).toContainText(
    '170 trimestres',
  );
  const graphic = page.getByRole('link', { name: /Télécharger le graphique/ });
  const href = (await graphic.getAttribute('href'))!;
  const response = await page.request.get(new URL(href, baseURL).href);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/svg+xml');
  expect(await response.text()).toContain('62 ans et 9 mois');
  const download = page.waitForEvent('download');
  await graphic.click();
  expect((await download).suggestedFilename()).toBe(
    'polradar-retraites-1963-mars-1965-2026-11-19.svg',
  );
  await context.close();
});

test('la recherche communale est locale et ses liens conservent les deux tours', async ({
  page,
  baseURL,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== baseURL) external.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/communes/');
  await expect(page.locator('#commune-name')).toHaveText('Chartres');
  await expect(page.locator('#commune-vacancy')).toHaveText(/10,9\s%/);
  let input = page.getByRole('searchbox', {
    name: 'Nom de commune ou code Insee',
  });
  await input.fill('pointe a pitre');
  await page.getByRole('link', { name: /Pointe-à-Pitre.*97120/ }).click();
  await expect(page).toHaveURL(/#commune=97120$/);
  await expect(page.locator('#commune-name')).toHaveText('Pointe-à-Pitre');
  await expect(
    page
      .locator('[data-commune-round]')
      .nth(1)
      .locator('[data-candidate-votes]')
      .first(),
  ).toHaveText(/3\s?180 voix/);
  await page.reload();
  await expect(page.locator('#commune-name')).toHaveText('Pointe-à-Pitre');
  await page.getByText('Voir les 7 autres résultats').click();
  await expect(page.locator('[data-candidate-result]:visible')).toHaveCount(14);
  input = page.getByRole('searchbox');
  await input.fill('02078');
  await input.press('Enter');
  await expect(page.locator('#commune-name')).toHaveText('Besmé');
  await expect(page.locator('[data-no-expressed]').first()).toBeVisible();
  await expect(page.locator('[data-no-expressed]').nth(1)).toBeHidden();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('un fichier communal indisponible ne remplace pas le dernier résultat affiché', async ({
  page,
}) => {
  await page.route('**/data/communes/2022/75.json', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('/communes/#commune=75056');
  await expect(page.locator('#commune-status')).toHaveText(
    'Les résultats de cette commune sont momentanément indisponibles.',
  );
  await expect(page.locator('#commune-name')).toHaveText('Chartres');
  await expect(page.locator('#commune-permalink')).toHaveAttribute(
    'href',
    '#commune=28085',
  );
});

test('les deux vues tiennent sur un écran étroit', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    for (const route of [
      '/comparer/retraites/1961-septembre/',
      '/communes/#commune=01187',
    ]) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      if (route.startsWith('/communes/'))
        await expect(
          page.locator('#commune-context-unavailable'),
        ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
        `${route} · ${width}px`,
      ).toBe(false);
    }
  }
});

test('les dossiers numériques s’explorent sur mobile et renvoient à leurs sources', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/numerique/');
  await expect(
    page.getByRole('heading', { name: 'Propositions sur le numérique' }),
  ).toBeVisible();
  await expect(page.locator('.digital-topics a')).toHaveCount(4);
  await page.locator('.digital-topics a[data-topic="calcul-energie"]').click();
  await expect(page).toHaveURL(/\/numerique\/calcul-energie\/$/);
  await expect(
    page.locator('.digital-topics [aria-current="page"]'),
  ).toHaveCount(1);
  const pager = page
    .getByRole('navigation', { name: 'Pagination des résultats' })
    .first();
  await expect(pager).toBeVisible();
  const quantities = [
    {
      label: 'Capacité visée en 2030',
      values: ['1 GW'],
      programme:
        'https://www.avecretailleau.fr/projet/mesure/construire-nos-data-centers-souverains',
    },
    { label: 'Enveloppe annoncée pour 2027', values: [/700\sM€/] },
    {
      label: 'Budget annuel proposé du laboratoire',
      values: ['500 personnes', '1 Md€'],
    },
  ];
  const seen: string[] = [];
  for (;;) {
    for (const item of quantities) {
      const card = page
        .locator('.digital-card:visible')
        .filter({ hasText: item.label });
      if (!(await card.count())) continue;
      await expect(card.locator('dd')).toHaveText(item.values);
      if (item.programme) {
        await expect(
          card.getByRole('link', { name: 'Programme officiel ↗' }),
        ).toHaveAttribute('href', item.programme);
      }
      seen.push(item.label);
    }
    const next = pager.getByRole('link', { name: 'Page suivante' });
    if (!(await next.count())) break;
    await next.click();
  }
  expect(seen.sort()).toEqual(quantities.map((item) => item.label).sort());
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});
