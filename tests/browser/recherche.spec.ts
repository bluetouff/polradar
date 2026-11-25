import { expect, test } from '@playwright/test';
import { testOrigin } from './origin';

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

  await search.fill('Comment accéder aux soins ?');
  await search.press('Enter');
  await expect(page.locator('#search-results a').first()).toHaveAttribute(
    'href',
    '/questions/soins-de-proximite/',
  );
  await expect(page.locator('#resultats')).toBeFocused();

  await search.fill('Calculer la contribution sociale généralisée');
  await expect(
    page.locator('#search-results a[href="/economie/simulateurs/"]'),
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
