import { testOrigin } from './origin';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pageSize } from '../../src/lib/pagination';
import measures from '../../src/data/measures.json' with { type: 'json' };
import candidates from '../../src/data/candidates.json' with { type: 'json' };
const current = measures.filter((m) => m.scope !== 'archive');
const pager = '[data-pager]';
test('le catalogue statique se parcourt sans JavaScript, y compris sa dernière page', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: testOrigin,
  });
  const page = await context.newPage();
  for (const [path, selector] of [
    ['/mesures/', '#measure-results article'],
    ['/sources/', '#sources-list article'],
    ['/engagements/', '#engagement-list article'],
    ['/recherche/', ':is(#search-results, #search-fallback) article'],
    ['/themes/fiscalite/', '.measure-list article'],
  ]) {
    await page.goto(path);
    const results = page.locator(selector);
    await expect(results).toHaveCount(pageSize);
    const firstTitle = await results.first().innerText();
    await page
      .locator(pager)
      .first()
      .getByRole('link', { name: 'Page suivante' })
      .click();
    await expect(page).toHaveURL(new RegExp(path + 'page/2/#resultats$'));
    await expect(results).toHaveCount(pageSize);
    expect(await results.first().innerText()).not.toBe(firstTitle);
  }
  const lastPage = Math.ceil(current.length / pageSize);
  await page.goto('/mesures/page/' + lastPage + '/');
  await expect(page.locator('#measure-results article')).toHaveCount(
    current.length - (lastPage - 1) * pageSize,
  );
  await expect(page.locator('#measure-results article').last()).toContainText(
    current.at(-1)!.title,
  );
  await expect(
    page.locator(pager).first().getByRole('link', { name: 'Page suivante' }),
  ).toHaveCount(0);
  await context.close();
});
test('les filtres changent de page, reviennent au premier résultat et se restaurent avec Retour', async ({
  page,
}) => {
  const philippe = current.filter((m) => m.candidate === 'philippe');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/mesures/#candidate=philippe&page=2');
  await expect(page.locator('#measure-results article').first()).toContainText(
    philippe[pageSize].title,
  );
  const next = page
    .locator(pager)
    .first()
    .getByRole('link', { name: 'Page suivante' });
  await next.click();
  await expect(page).toHaveURL(/candidate=philippe&page=3/);
  await page.reload();
  await expect(page.locator('#measure-results article').first()).toContainText(
    philippe[pageSize * 2].title,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page
    .locator('#measure-filters [name=candidate]')
    .selectOption('lassalle');
  await expect(page).toHaveURL(/#candidate=lassalle$/);
  await expect(page.locator('#measure-results article')).toHaveCount(
    current.filter((m) => m.candidate === 'lassalle').length,
  );
  await expect(page.locator(pager).first()).toBeHidden();
  await page.goBack();
  await expect(page.locator('#measure-results article').first()).toContainText(
    philippe[pageSize * 2].title,
  );
  await page.goto('/mesures/#candidate=lassalle&page=9999');
  await expect(page).toHaveURL(/#candidate=lassalle$/);
  await page.locator('#measure-filters input[name=q]').fill('zzzaucunefiche');
  await expect(page.locator('#measure-count')).toHaveText('0 résultat');
  await expect(page.locator(pager).first()).toBeHidden();
});
test('les quatre nouvelles candidatures livrent les fiches primaires et les archives de Lassalle restent identifiées', async ({
  page,
}) => {
  expect(
    new Set(current.filter((m) => m.scope !== 'parti').map((m) => m.candidate)),
  ).toEqual(new Set(candidates.map((c) => c.id)));
  for (const id of ['lassalle', 'durif', 'billetdoux', 'riner']) {
    const records = current.filter((m) => m.candidate === id);
    await page.goto('/mesures/#candidate=' + id);
    await expect(page.locator('#measure-count')).toHaveText(
      records.length + ' résultats',
    );
    await expect(page.locator('#measure-results h3 a').first()).toHaveAttribute(
      'href',
      '/mesures/' + records[0].id + '/',
    );
    await expect(
      page.locator('#measure-results article .tag.archive'),
    ).toHaveCount(0);
  }
  await page.goto('/mesures/#candidate=lassalle&archives=1');
  const historical = measures.filter(
    (m) => m.candidate === 'lassalle' && m.scope === 'archive',
  );
  expect(historical.length).toBeGreaterThan(0);
  const total = measures.filter((m) => m.candidate === 'lassalle').length;
  await expect(page.locator('#measure-count')).toHaveText(total + ' résultats');
  const displayed: string[] = [];
  for (let n = 1; n <= Math.ceil(total / pageSize); n++) {
    if (n > 1) {
      await page
        .locator(pager)
        .first()
        .getByRole('link', { name: 'Page suivante' })
        .click();
      await expect(page).toHaveURL(new RegExp('page=' + n));
    }
    const links = page
      .locator('#measure-results article')
      .filter({ has: page.locator('.tag.archive') })
      .locator('h3 a');
    displayed.push(
      ...(await links.evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute('href')!),
      )),
    );
  }
  expect(displayed.sort()).toEqual(
    historical.map((m) => `/mesures/${m.id}/`).sort(),
  );
  await page.goto('/mesures/lassalle-smic-conjoint-elevage/#sources');
  await expect(
    page.locator('.precise-sources a[href*="pleinchamp.com"]'),
  ).toBeVisible();
});
test('l’export porte sur tous les résultats de la recherche même depuis la deuxième page', async ({
  page,
}) => {
  await page.goto('/recherche/#type=mesure&page=2');
  await expect(page.locator('#search-count')).toHaveText(
    current.length + ' résultats',
  );
  await expect(page.locator('#search-results article')).toHaveCount(pageSize);
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-json').click();
  const data = JSON.parse(
    await readFile((await (await downloaded).path())!, 'utf8'),
  );
  expect(data.map((x: { url: string }) => x.url)).toEqual(
    current.map((m) => '/mesures/' + m.id + '/'),
  );
});
test('un index indisponible laisse une pagination HTML fonctionnelle', async ({
  page,
}) => {
  await page.route('**/api/corpus.json', (route) => route.abort());
  await page.goto('/mesures/#candidate=lassalle');
  await expect(page.locator('#measure-count')).toContainText(
    'Filtres indisponibles',
  );
  await expect(page.locator('#measure-results article')).toHaveCount(pageSize);
  await page
    .locator(pager)
    .first()
    .getByRole('link', { name: 'Page suivante' })
    .click();
  await expect(page).toHaveURL(/\/mesures\/page\/2\/#resultats$/);
  await expect(page.locator('#measure-results article').first()).toContainText(
    current[pageSize].title,
  );
  await page
    .locator('#measure-filters [name=candidate]')
    .selectOption('lassalle');
  await expect(page.locator('#measure-count')).toContainText(
    'Filtres indisponibles',
  );
  await page.unroute('**/api/corpus.json');
  await page.getByRole('button', { name: 'Filtrer', exact: true }).click();
  await expect(page.locator('#measure-count')).toHaveText(
    current.filter((m) => m.candidate === 'lassalle').length + ' résultats',
  );
});

test('un repère de veille ouvre sa source, même au-delà des douze premières fiches', async ({
  page,
}) => {
  await page.goto('/veille/');
  const cells = page.locator('[data-watch-cell]');
  const last = await cells.last().getAttribute('href');
  expect(last).toMatch(/^#watch-/);
  await cells.last().click();
  await expect(page.locator(last!)).toBeVisible();
  await expect(page.locator(last!)).toBeInViewport();
  await expect(page.locator('[data-pager]').first()).toContainText('sur');
  await page.reload();
  await expect(page.locator(last!)).toBeVisible();
});
test('les pictogrammes partagés gardent leur tracé sous la CSP de la page', async ({
  page,
}) => {
  const messages: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') messages.push(m.text());
  });
  await page.goto('/themes/fiscalite/');
  const drawing = page.locator('.feature-emblem .icon.i-fiscalite');
  await expect(drawing).toBeVisible();
  const mask = await drawing.evaluate((el) => {
    const css = getComputedStyle(el);
    return {
      image: css.maskImage,
      position: css.getPropertyValue('--icon-y'),
      width: el.getBoundingClientRect().width,
    };
  });
  expect(mask.image).toMatch(/pictos-menu\/[a-f0-9]+\.svg/);
  expect(mask.position).toMatch(/%/);
  expect(mask.width).toBeGreaterThan(0);
  expect(
    messages.filter((m) => m.toLowerCase().includes('content security')),
  ).toEqual([]);
});

test('la recherche par année trouve la profession de foi et ses archives quand seul le millésime est connu', async ({
  page,
}) => {
  await page.goto(
    '/recherche/#candidate=lassalle&type=mesure&year=2022&archives=1',
  );
  const archive = measures.filter(
    (m) => m.scope === 'archive' && m.candidate === 'lassalle',
  );
  await expect(page.locator('#search-count')).toHaveText(
    archive.length + ' résultats',
  );
  await expect(page.locator('#search-results article')).toHaveCount(
    Math.min(pageSize, archive.length),
  );
  if (archive.length > pageSize) {
    await page
      .locator(pager)
      .first()
      .getByRole('link', { name: 'Page suivante' })
      .click();
    await expect(page.locator('#search-results article')).toHaveCount(
      Math.min(pageSize, archive.length - pageSize),
    );
  }
});
