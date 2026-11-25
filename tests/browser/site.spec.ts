import { testOrigin } from './origin';
import { test, expect } from '@playwright/test';

test('les pages restent lisibles sur mobile et bureau', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/candidats/',
      '/candidats/philippe/',
      '/comparer/',
      '/economie/',
      '/sources/',
    ]) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `${route} à ${width}px`).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});
test('le comparateur conserve une sélection de deux candidatures', async ({
  page,
}) => {
  await page.goto('/comparer/?theme=fiscalite&c=philippe,melenchon&archives=0');
  await expect(page.locator('.comparison-card')).toHaveCount(2);
  await expect(page.locator('#comparison-theme-title')).toHaveText(
    'Fiscalité & budget',
  );
  await page.locator('#compare-theme').selectOption('climat');
  await expect(page).toHaveURL(/theme=climat/);
  await expect(page.locator('.comparison-card')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#compare-theme')).toHaveValue('climat');
  await page.locator('#compare-candidate-0').selectOption('asselineau');
  await page
    .getByRole('checkbox', { name: 'Ajouter un troisième candidat' })
    .check();
  await expect(page.locator('#compare-candidate-2')).toHaveValue('');
  await page.locator('#compare-candidate-2').selectOption('roussel');
  await expect(page.locator('.comparison-card')).toHaveCount(3);
  const names = await page.locator('.comparison-card h3').allTextContents();
  expect(new Set(names).size).toBe(3);
});
test('les paramètres non reconnus restent du texte sans exécution', async ({
  page,
}) => {
  await page.goto(
    '/comparer/?theme=%3Cimg%20src=x%20onerror=alert(1)%3E&c=philippe,philippe,inconnu',
  );
  await expect(page.locator('.comparison-card')).toHaveCount(0);
  await expect(page.locator('#compare-theme')).toHaveValue('retraites');
  await expect(page.locator('#comparaison')).toBeHidden();
  expect(await page.locator('img[src=x]').count()).toBe(0);
});
test('recherche locale et absence de requêtes vers des tiers', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(`${testOrigin}/`))
      external.push(request.url());
  });
  await page.goto('/recherche/');
  await expect(
    page
      .locator('#search-results .advanced-result')
      .first()
      .getByRole('link', { name: 'Retraites', exact: true }),
  ).toHaveAttribute('href', '/themes/retraites/');
  await page.getByRole('searchbox').fill('Philippe');
  await expect(
    page.locator('#search-results .advanced-result:visible').first(),
  ).toContainText('Philippe');
  await page.getByRole('searchbox').fill('aucunresultatpossible');
  await expect(page.locator('[role=status]')).toHaveText('0 résultat');
  expect(external).toEqual([]);
});
test('une erreur de chargement préserve la comparaison initiale', async ({
  page,
}) => {
  let downloads = 0;
  await page.route('**/api/corpus.json', (route) => {
    downloads++;
    return route.abort();
  });
  await page.goto('/comparer/');
  await page.locator('#compare-candidate-0').selectOption('philippe');
  await expect(page.locator('#comparison-feedback')).toContainText(
    'deuxième candidature',
  );
  expect(downloads).toBe(0);
  await page.locator('#compare-candidate-1').selectOption('roussel');
  await expect(page.locator('#comparison-feedback')).toContainText(
    'n’a pas pu être chargé',
  );
  await expect(page.locator('.comparison-card')).toHaveCount(0);
});
test('la comparaison initiale reste accessible sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${testOrigin}/comparer/`);
  await expect(page.locator('.comparison-card')).toHaveCount(0);
  await expect(page.locator('noscript')).toBeVisible();
  await context.close();
});

test('la recherche depuis l’accueil transmet la requête seulement dans le fragment', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  const input = page.getByRole('searchbox', {
    name: 'Rechercher dans Polradar',
  });
  await input.fill('suppression de la CSG');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/recherche\/#q=suppression\+de\+la\+CSG$/);
  await expect(page.locator('#search-results')).toContainText('CSG');
  expect(requests.every((url) => new URL(url).origin === testOrigin)).toBe(
    true,
  );
  expect(requests.every((url) => !url.includes('suppression'))).toBe(true);
  await page.getByRole('searchbox').fill('demandeabsenteabcd123');
  await expect(
    page.getByRole('heading', { name: 'Aucun résultat' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Réinitialiser la recherche' })
    .click();
  await expect(page.getByRole('searchbox')).toBeFocused();
  await expect(page.getByRole('searchbox')).toHaveValue('');
});

test('le comparateur exporte la sélection et ses références depuis le navigateur', async ({
  page,
}) => {
  await page.goto('/comparer/?c=philippe,melenchon');
  await expect(page.locator('.comparison-card')).toHaveCount(2);
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter en JSON' }).click();
  const download = await waiting;
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const parts: Buffer[] = [];
  for await (const part of stream!) parts.push(Buffer.from(part));
  const selection = JSON.parse(Buffer.concat(parts).toString('utf8'));
  expect(selection.candidates).toEqual(['philippe', 'melenchon']);
  expect(selection.theme).toBe('retraites');
  expect(selection.measures.length).toBeGreaterThan(1);
  expect(
    selection.measures
      .flatMap(
        (measure: { sourceRefs: { sourceId: string }[] }) => measure.sourceRefs,
      )
      .every(({ sourceId }: { sourceId: string }) =>
        selection.sources.some(({ id }: { id: string }) => id === sourceId),
      ),
  ).toBe(true);
});
