import { expect, test } from '@playwright/test';

const first = '/mesures/attal-csg-salaires/';
const second = '/mesures/philippe-retraites-2/';
const reader = '/hors-ligne/v1/';
const marker = 'meta[name="polradar-copy-revision"]';
const key = 'polradar-fiche-hors-ligne-v1';

test('une fiche choisie reste lisible après réouverture hors connexion et peut être effacée', async ({
  context,
  page,
  request,
}) => {
  const build = await request
    .get('/build.json')
    .then((response) => response.json());
  await page.goto(first);
  const title = await page.locator('h1').textContent();
  const description = await page.locator('.measure-lead').textContent();
  const source = await page
    .locator('#sources')
    .locator('../..')
    .locator('ul a')
    .first()
    .getAttribute('href');
  expect(await page.locator(marker).getAttribute('content')).toBe(
    build.sourceCommit,
  );
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length,
    ),
  ).toBe(0);
  await page.evaluate(() =>
    localStorage.setItem('polradar.follow.v1', 'une-preference-locale'),
  );
  await page.getByRole('button', { name: 'Garder hors ligne' }).click();
  await expect(
    page.getByText('Fiche disponible hors connexion.'),
  ).toBeVisible();
  expect(
    await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistrations()).map(
        (reg) => new URL(reg.scope).pathname,
      ),
    ),
  ).toEqual(['/hors-ligne/']);
  expect(
    await page.evaluate(async () =>
      (await (await caches.open('polradar-lecteur-v1')).keys())
        .map((item) => new URL(item.url).pathname)
        .sort(),
    ),
  ).toEqual([
    '/hors-ligne/lecteur-v1.css',
    '/hors-ligne/lecteur-v1.js',
    '/hors-ligne/v1/',
  ]);
  await page.close();
  await context.setOffline(true);
  const local = await context.newPage();
  await local.setViewportSize({ width: 320, height: 730 });
  const reopened = await local.goto(reader);
  expect(reopened?.fromServiceWorker()).toBe(true);
  await expect(
    local.getByText('Hors connexion', { exact: true }),
  ).toBeVisible();
  await expect(local.getByRole('heading', { name: title! })).toBeVisible();
  await expect(local.locator('[data-description]')).toHaveText(description!);
  await expect(local.locator('[data-sources] a').first()).toHaveAttribute(
    'href',
    source!,
  );
  await expect(local.getByText(build.sourceCommit)).toBeVisible();
  await expect(local.getByText('Copie enregistrée le')).toBeVisible();
  await expect(local.getByText('Date de l’édition')).toBeVisible();
  expect(
    await local.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await local
    .getByRole('button', { name: 'Effacer la copie et le cache' })
    .click();
  await expect(
    local.getByText('Copie et cache effacés de cet appareil.'),
  ).toBeVisible();
  expect(
    await local.evaluate((name) => localStorage.getItem(name), key),
  ).toBeNull();
  expect(await local.evaluate(() => caches.keys())).toEqual([]);
  expect(
    await local.evaluate(() => localStorage.getItem('polradar.follow.v1')),
  ).toBe('une-preference-locale');
});

test('une interruption garde la copie complète et la sauvegarde suivante la remplace', async ({
  context,
  page,
}) => {
  await page.goto(first);
  await page.getByRole('button', { name: 'Garder hors ligne' }).click();
  await expect(
    page.getByText('Fiche disponible hors connexion.'),
  ).toBeVisible();
  const before = await page.evaluate((name) => localStorage.getItem(name), key);
  expect(before).not.toBeNull();
  await page.addInitScript((name) => {
    if (!new URL(location.href).searchParams.has('interruption')) return;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === name)
        throw new DOMException('Espace indisponible', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  }, key);
  await page.goto(second + '?interruption=1');
  await page.getByRole('button', { name: 'Garder hors ligne' }).click();
  await expect(
    page.getByText('La copie n’a pas pu être enregistrée.'),
  ).toBeVisible();
  expect(await page.evaluate((name) => localStorage.getItem(name), key)).toBe(
    before,
  );
  await context.setOffline(true);
  await page.goto(reader);
  await expect(
    page.getByRole('heading', { name: JSON.parse(before!).title }),
  ).toBeVisible();
  await expect(page.getByText(JSON.parse(before!).revision)).toBeVisible();
  await context.setOffline(false);

  // Révision d’essai pour représenter l’arrivée d’un autre HTML publié.
  const nextRevision = 'a'.repeat(40);
  await page.route('**' + second, async (route) => {
    const release = await route.fetch();
    const body = (await release.text()).replace(
      /(<meta name="polradar-copy-revision" content=")[a-f0-9]{40}/,
      '$1' + nextRevision,
    );
    await route.fulfill({ response: release, body });
  });
  await page.goto(second);
  const newTitle = await page.locator('h1').textContent();
  expect(await page.locator(marker).getAttribute('content')).toBe(nextRevision);
  expect(await page.evaluate((name) => localStorage.getItem(name), key)).toBe(
    before,
  );
  await page.getByRole('button', { name: 'Garder hors ligne' }).click();
  await expect(
    page.getByText('Fiche disponible hors connexion.'),
  ).toBeVisible();
  await context.setOffline(true);
  await page.goto(reader);
  await expect(page.getByRole('heading', { name: newTitle! })).toBeVisible();
  await expect(page.getByText(nextRevision)).toBeVisible();
  await expect(page.getByText(JSON.parse(before!).revision)).toHaveCount(0);
  await expect(page.locator('[data-original]')).toHaveAttribute('href', second);
});

test('une copie altérée reste effaçable depuis le lecteur', async ({
  page,
}) => {
  await page.goto(first);
  await page.getByRole('button', { name: 'Garder hors ligne' }).click();
  await expect(
    page.getByText('Fiche disponible hors connexion.'),
  ).toBeVisible();
  await page.evaluate((name) => {
    const original = JSON.parse(localStorage.getItem(name)!);
    original.revision = 'a'.repeat(40);
    localStorage.setItem(name, JSON.stringify(original));
  }, key);
  await page.goto(reader);
  await expect(page.locator('[data-record]')).toBeHidden();
  await page
    .getByRole('button', { name: 'Effacer la copie et le cache' })
    .click();
  await expect(
    page.getByText('Copie et cache effacés de cet appareil.'),
  ).toBeVisible();
});
