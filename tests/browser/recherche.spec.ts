import { expect, test } from '@playwright/test';
import { testOrigin } from './origin';

test('la recherche retrouve le relèvement du SMIC et l’ouverture des droits à la retraite', async ({
  page,
}) => {
  await page.goto('/recherche/');
  const query = page.getByRole('searchbox');
  for (const [text, href] of [
    [
      'Revalorisation du salaire minimum 1 700 euros Mélenchon',
      '/mesures/melenchon-travail-1/',
    ],
    [
      'Quel âge légal pour ouvrir les droits à la retraite ?',
      '/comparer/retraites/',
    ],
  ]) {
    await query.fill(text);
    await expect(
      page.locator(`#search-results a[href="${href}"]`),
    ).toBeVisible();
  }
});

test('la recherche mobile charge son index au premier usage et maintient le focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const requests: URL[] = [];
  page.on('request', (request) => requests.push(new URL(request.url())));

  await page.goto('/recherche/');
  const search = page.getByRole('searchbox', {
    name: 'Rechercher dans Polradar',
  });
  await expect(search).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Documents récents' }),
  ).toBeVisible();
  const indexRequests = () =>
    requests.filter(({ pathname }) => pathname === '/api/recherche.json');
  expect(indexRequests()).toHaveLength(0);

  await search.fill('soins de proximité');
  await search.press('Enter');
  await expect(
    page.locator('#search-results a[href="/questions/soins-de-proximite/"]'),
  ).toBeVisible();
  await expect(page.locator('#resultats')).toBeFocused();

  await search.fill('Calculer la contribution sociale généralisée');
  await expect(
    page.locator('#search-results a[href="/economie/simulateurs/"]'),
  ).toBeVisible();
  await search.fill("C'est quoi le programme de branco sur le numérique ?");
  await expect(
    page.locator('#search-results a[href^="/mesures/branco-"]').first(),
  ).toBeVisible();
  expect(indexRequests()).toHaveLength(1);
  expect(indexRequests()[0].search).toBe('');
  expect(requests.filter(({ origin }) => origin !== testOrigin)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
