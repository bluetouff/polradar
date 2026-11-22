import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';

const snapshotDay = new Date('2026-11-22T19:55:00Z');
const sharedMeeting =
  '/suivi/#changement=2026-11-22:agenda-063cb7900107-kazib-paris-1121';

test('un autre site affiche les deux codes HTML sans JavaScript, sans référent et sans débordement', async ({
  browser,
  baseURL,
  request,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 760 },
  });
  const page = await context.newPage();
  await page.goto(new URL('/comparer/retraites/1966/', baseURL).href);
  await page.locator('#integrer > summary').click();
  const actualisee = await page.locator('#code-actualisee').inputValue();
  await page.getByText('Version figée', { exact: true }).click();
  const figee = await page.locator('#code-figee').inputValue();
  const archivedPath = await page
    .getByRole('link', { name: 'Télécharger cette édition' })
    .getAttribute('href');
  const fetched: { url: string; referrer: string | undefined; body: Buffer }[] =
    [];
  await context.route(
    'https://polradar.fr/graphiques/retraites/**',
    async (route) => {
      const url = route.request().url(),
        headers = await route.request().allHeaders();
      const result = await request.get(
        new URL(new URL(url).pathname, baseURL).href,
      );
      expect(result.status()).toBe(200);
      const body = await result.body();
      fetched.push({ url, referrer: headers.referer, body });
      await route.fulfill({ contentType: 'image/svg+xml', body });
    },
  );
  const external = await context.newPage(),
    requests: string[] = [];
  external.on('request', (r) => requests.push(r.url()));
  for (const [name, snippet] of [
    ['actualisee', actualisee],
    ['figee', figee],
  ]) {
    const article = 'https://publication.example/' + name;
    await context.route(article, (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body:
          '<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width"><title>Article</title><main>' +
          snippet +
          '</main></html>',
      }),
    );
    await external.goto(article);
    const image = external.locator('img');
    await expect(image).toHaveJSProperty('naturalWidth', 480);
    expect((await image.boundingBox())!.width).toBeLessThanOrEqual(320);
    expect(
      await external.locator('html').evaluate((el) => el.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    const codeLinks = external.locator('figure a');
    expect(await codeLinks.count()).toBeGreaterThan(0);
    await expect(codeLinks.first()).toHaveAttribute('rel', 'noreferrer');
    expect(await external.locator('script,iframe').count()).toBe(0);
  }
  const [live, fixed] = fetched;
  expect(
    requests.filter((url) => !url.startsWith('https://publication.example/')),
  ).toEqual([live.url, fixed.url]);
  expect(live.url).toBe('https://polradar.fr/graphiques/retraites/1966.svg');
  expect(new URL(fixed.url).pathname).toBe(archivedPath);
  expect(new URL(fixed.url).pathname).toContain(
    '/editions/' +
      createHash('sha256').update(fixed.body).digest('hex') +
      '.svg',
  );
  expect(live.body.equals(fixed.body)).toBe(true);
  expect(fetched.map((r) => r.referrer)).toEqual([undefined, undefined]);
  expect(await context.cookies()).toEqual([]);
  await context.close();
});

test('le code affiché par le lien d’intégration se copie tel quel', async ({
  page,
  context,
  baseURL,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: baseURL!,
  });
  await page.goto('/comparer/retraites/');
  await page.getByRole('link', { name: 'Intégrer le graphique' }).click();
  const input = page.locator('#code-actualisee');
  await expect(input).toBeVisible();
  await page.getByRole('button', { name: 'Copier le code' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    await input.inputValue(),
  );
  await expect(page.locator('.embed-feedback')).toHaveText('Code HTML copié.');
});

test('le suivi part sans candidat, affiche un vrai changement et partage ses sources sans transmettre les préférences', async ({
  page,
  browser,
  baseURL,
}) => {
  await page.clock.setFixedTime(snapshotDay);
  const shardQueries: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/suivi/'))
      shardQueries.push(r.url());
  });
  await page.goto('/suivi/');
  await expect(page.locator('#since-all')).toBeVisible();
  await expect(page.locator('#since-cards article')).toHaveCount(0);
  await expect(
    page.locator('[data-follow-kind][aria-pressed=true]'),
  ).toHaveCount(0);
  expect(shardQueries).toEqual([]);
  await page.locator('[data-follow-id=kazib]').click();
  const entry = page
    .locator('#since-cards article')
    .filter({ hasText: 'Rendez-vous modifié' })
    .first();
  await expect(entry.locator('.change-before dd')).toHaveText('Annoncé');
  await expect(entry.locator('.change-after dd')).toHaveText('Tenu');
  const shared = await entry
    .getByRole('link', { name: /Lien permanent/ })
    .getAttribute('href');
  expect(shared).toBe(sharedMeeting);
  expect(
    shardQueries.every(
      (url) =>
        /^\/api\/suivi\/\d{4}-\d{2}-\d{2}\.json$/.test(new URL(url).pathname) &&
        !new URL(url).search,
    ),
  ).toBe(true);
  const clean = await browser.newContext({
    viewport: { width: 360, height: 800 },
  });
  const recipient = await clean.newPage();
  await recipient.goto(new URL(shared!, baseURL).href);
  await expect(recipient.locator('#since-status')).toHaveText(
    'Changement partagé.',
  );
  await expect(recipient.locator('#since-cards article')).toHaveCount(1);
  await recipient.locator('.change-before summary').click();
  await recipient.locator('.change-after summary').click();
  await expect(recipient.locator('.change-before a').first()).toHaveAttribute(
    'href',
    /^https:\/\/www\.revolutionpermanente\.fr\//,
  );
  await expect(recipient.locator('.change-after a').last()).toHaveAttribute(
    'href',
    /^https:\/\/www\.youtube\.com\//,
  );
  expect(
    await recipient.evaluate(() => localStorage.getItem('polradar.follow.v1')),
  ).toBeNull();
  expect(
    await recipient
      .locator('#depuis-hier')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await recipient.getByRole('link', { name: 'Revenir à mon suivi' }).click();
  await expect(recipient.locator('#since-cards article')).toHaveCount(0);
  await clean.close();
});

test('le suivi hebdomadaire distingue séance et consignation, pagine et signale un journal indisponible', async ({
  page,
}) => {
  await page.clock.setFixedTime(snapshotDay);
  await page.goto('/suivi/');
  await page.locator('[data-follow-id=lassalle]').click();
  await expect(page.locator('#since-status')).toContainText('24 heures');
  await expect(
    page
      .locator('#since-cards .since-kind')
      .filter({ hasText: 'Vote documenté' }),
  ).toHaveCount(0);
  await page.getByRole('radio', { name: '7 jours' }).check();
  await expect(page.locator('#since-status')).toContainText('7 derniers jours');
  // Other documents added the same week may appear before the votes.
  const vote = page.locator('#since-cards article').filter({
    has: page.locator('a[href$="vote-48ba981444d0-an15-1814-lassalle"]'),
  });
  while (
    !(await vote.count()) &&
    (await page.locator('#since-more').isVisible())
  )
    await page.locator('#since-more').click();
  await expect(vote.locator('.change-context')).toContainText('26 mars 2019');
  await expect(vote.locator('.change-before')).toContainText(
    'Première inscription',
  );
  await expect(vote.locator('.since-time')).toHaveAttribute(
    'datetime',
    /^2026-11-20/,
  );
  await page.locator('#since-all').click();
  await expect(page.locator('#since-cards article')).toHaveCount(6);
  await page.locator('#since-more').click();
  await expect(page.locator('#since-cards article')).toHaveCount(12);
  await page.route('**/api/suivi/2026-11-22.json', (route) =>
    route.fulfill({ status: 503, body: '' }),
  );
  await page.goto(sharedMeeting);
  await page.reload();
  await expect(page.locator('#since-status')).toContainText('indisponible');
  await expect(page.locator('#since-cards article')).toHaveCount(0);
});
