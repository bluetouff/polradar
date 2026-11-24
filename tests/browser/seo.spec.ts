import { expect, test } from '@playwright/test';
import budgets from '../../src/data/programme-budgets.json' with { type: 'json' };
import versions from '../../src/data/versions.json' with { type: 'json' };

test('les principales rubriques ont des titres et descriptions distincts', async ({
  page,
}) => {
  const descriptions = new Set<string>();
  const titles = new Set<string>();
  for (const route of [
    '/',
    '/candidats/',
    '/sondages/',
    '/themes/',
    '/reperes/',
    '/comparer/',
    '/questions/',
    '/budget-programmes/',
    '/dossiers/',
    '/mesures/',
  ]) {
    await page.goto(route);
    await expect(page).toHaveTitle(/présidentielle 2027.* · Polradar$/i);
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /\S/);
    const content = (await description.getAttribute('content'))!;
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute('content', content);
    expect(descriptions.has(content), route).toBe(false);
    descriptions.add(content);
    const title = await page.title();
    expect(titles.has(title), route).toBe(false);
    titles.add(title);
  }
});

test('les trois pages Retraites sont reliées au clavier sur mobile sans JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 320, height: 850 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const overview = page
      .locator('.theme-register')
      .getByRole('link', { name: /^Retraites/ });
    await overview.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/themes/retraites/');

    const themeNav = page.getByRole('navigation', {
      name: 'Approfondir les retraites',
    });
    await expect(
      themeNav.getByRole('link', { name: /par génération/ }),
    ).toHaveAttribute('href', '/comparer/retraites/');
    await themeNav.getByRole('link', { name: /Âge de départ/ }).click();
    await expect(page).toHaveURL('/questions/retraites-conditions-depart/');

    const questionNav = page.getByRole('navigation', {
      name: 'Explorer cette question',
    });
    await expect(
      questionNav.getByRole('link', { name: /Toutes les propositions/ }),
    ).toHaveAttribute('href', '/themes/retraites/');
    await questionNav.getByRole('link', { name: /par génération/ }).click();
    await expect(page).toHaveURL('/comparer/retraites/');

    const comparisonNav = page.getByRole('navigation', {
      name: 'Approfondir les retraites',
    });
    await expect(
      comparisonNav.getByRole('link', { name: /Âge de départ/ }),
    ).toHaveAttribute('href', '/questions/retraites-conditions-depart/');
    await comparisonNav
      .getByRole('link', { name: /Toutes les propositions/ })
      .click();
    await expect(page).toHaveURL('/themes/retraites/');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
  } finally {
    await context.close();
  }
});

test('le sitemap réserve lastmod aux dates éditoriales documentées', async ({
  page,
  request,
}) => {
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);
  const sitemap = await page.evaluate(
    (source) => {
      const xml = new DOMParser().parseFromString(source, 'application/xml');
      if (xml.querySelector('parsererror'))
        throw new Error('Sitemap XML invalide');
      return Object.fromEntries(
        [...xml.querySelectorAll('url')].map((entry) => [
          entry.querySelector('loc')!.textContent,
          entry.querySelector('lastmod')?.textContent ?? null,
        ]),
      );
    },
    await response.text(),
  );

  const knownVersion = versions.find(
    ({ id }) => id === 'durif-deforestation-v1',
  )!;
  expect(sitemap['https://polradar.fr/budget-programmes/']).toBe(
    budgets.checked,
  );
  expect(sitemap['https://polradar.fr/mesures/durif-deforestation/']).toBe(
    knownVersion.recordedAt,
  );
  expect(sitemap['https://polradar.fr/dossiers/indexation-pensions/']).toMatch(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  expect(
    sitemap['https://polradar.fr/mesures/melenchon-fiscalite-2/'],
  ).toBeNull();
  expect(sitemap['https://polradar.fr/themes/retraites/']).toBeNull();
  expect(sitemap['https://polradar.fr/recherche/']).toBeUndefined();
  expect(sitemap['https://polradar.fr/404.html']).toBeUndefined();
});

test('la page d’accueil nomme le site et la fiche décrit sa propre URL', async ({
  page,
}) => {
  for (const [path, type] of [
    ['/', 'WebSite'],
    ['/mesures/attal-csg-salaires/', 'WebPage'],
  ]) {
    await page.goto(path);
    const item = page.locator('html[itemscope]');
    await expect(item).toHaveAttribute(
      'itemtype',
      'https://schema.org/' + type,
    );
    await expect(item.locator('[itemprop=url]')).toHaveAttribute(
      'content',
      'https://polradar.fr' + path,
    );
    await expect(item.locator('[itemprop=description]')).toHaveAttribute(
      'content',
      /\S/,
    );
    if (type === 'WebSite')
      await expect(item.locator('[itemprop=name]')).toHaveAttribute(
        'content',
        'Polradar',
      );
    else
      expect(await item.locator('[itemprop=name]').textContent()).toMatch(
        /CSG/i,
      );
  }
  await page.goto('/recherche/');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute(
    'content',
    /noindex/,
  );
});
