import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { pollSchema } from '../../src/lib/schema.mjs';
import pollRows from '../../src/data/polls.json' with { type: 'json' };
import {
  pollGraphicSeriesId,
  pollGraphicCatalog,
} from '../../src/lib/poll-graphic.mjs';

const polls = pollSchema.array().parse(pollRows);
const historic = polls.find(({ id }) => id === 'elabe-2026-08-29-philippe')!;
const series = pollGraphicSeriesId(historic);

test('la vague affichée ouvre la bonne édition et la légende actualisée retrouve sa série', async ({
  page,
}) => {
  await page.goto('/sondages/#enquete=' + historic.id);
  const link = page.getByRole('link', {
    name: 'Intégrer ce graphique',
    exact: true,
  });
  await expect(link).toHaveAttribute(
    'href',
    '/sondages/integrer/' + historic.id + '/',
  );
  await link.click();
  await expect(page.locator('[data-mode="figee"]')).toHaveAttribute('open', '');
  await expect(page.locator('.preview-fixed')).toBeVisible();
  await page.locator('[data-mode="actualisee"] > summary').click();
  await expect(page.locator('.preview-live')).toBeVisible();
  const code = await page.locator('#code-actualisee').inputValue();
  expect(code).toContain('/graphiques/sondages/' + series + '.svg');
  expect(code).toContain('/sondages/#' + series);
  await page.goto('/sondages/#' + series);
  const latest = pollGraphicCatalog(polls).find(
    (row) => row.id === series,
  )!.latest;
  await expect(link).toHaveAttribute(
    'href',
    '/sondages/integrer/' + latest.id + '/',
  );
  await page.locator('#poll-wave').fill('0');
  await expect(link).toHaveAttribute(
    'href',
    '/sondages/integrer/' + historic.id + '/',
  );
});

for (const [label, path, group] of [
  ['sondage', '/sondages/integrer/' + historic.id + '/', 'sondages'],
  ['indicateur', '/economie/croissance/', 'economie'],
]) {
  test(
    label +
      ' publié dans un article tiers sans script, référent ni requête pour la copie figée',
    async ({ browser, request, baseURL }) => {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 320, height: 780 },
      });
      const page = await context.newPage();
      try {
        await page.goto(new URL(path, baseURL).href);
        const workbench = page.locator('#integrer');
        if (!((await workbench.getAttribute('open')) === ''))
          await workbench.locator(':scope > summary').click();
        const live = await page.locator('#code-actualisee').inputValue();
        const frozen = await page.locator('#code-figee').inputValue();
        const download = await page
          .getByRole('link', {
            name: 'Télécharger cette édition',
            includeHidden: true,
          })
          .getAttribute('href');
        const downloaded = await request.get(new URL(download!, baseURL).href);
        expect(downloaded.ok()).toBeTruthy();
        const bytes = await downloaded.body();
        const digest = createHash('sha256').update(bytes).digest('hex');
        expect(download).toBe('/graphiques/editions/' + digest + '.svg');
        const external = await context.newPage();
        const requests: string[] = [];
        await context.route(
          'https://polradar.fr/graphiques/**',
          async (route) => {
            const headers = await route.request().allHeaders();
            expect(headers.referer).toBeUndefined();
            expect(headers.cookie).toBeUndefined();
            requests.push(route.request().url());
            const image = await request.get(
              new URL(new URL(route.request().url()).pathname, baseURL).href,
            );
            expect(image.ok()).toBeTruthy();
            await route.fulfill({
              body: await image.body(),
              contentType: 'image/svg+xml',
            });
          },
        );
        const unexpected: string[] = [];
        external.on('request', (r) => {
          const url = new URL(r.url());
          if (
            url.protocol === 'https:' &&
            !['journal.example', 'polradar.fr'].includes(url.hostname)
          )
            unexpected.push(url.href);
        });
        for (const [mode, snippet] of [
          ['actualisee', live],
          ['figee', frozen],
        ]) {
          const article = 'https://journal.example/' + mode;
          await external.route(article, (route) =>
            route.fulfill({
              contentType: 'text/html; charset=utf-8',
              body:
                '<!DOCTYPE html><html lang="fr"><meta name="viewport" content="width=device-width"><title>Article</title><main>' +
                snippet +
                '</main></html>',
            }),
          );
          await external.goto(article);
          const img = external.locator('figure img');
          await expect
            .poll(() =>
              img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
            )
            .toBeGreaterThan(0);
          expect((await img.boundingBox())!.width).toBeLessThanOrEqual(320);
          await expect(
            external.locator('script, iframe, object, form'),
          ).toHaveCount(0);
          if (mode === 'figee') {
            const uri = (await img.getAttribute('src'))!;
            expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
            expect(
              Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64'),
            ).toEqual(bytes);
            expect(
              await external.locator('figcaption a').count(),
            ).toBeGreaterThan(1);
          }
          expect(requests).toHaveLength(1);
          expect(requests[0]).toContain('/graphiques/' + group + '/');
        }
        expect(unexpected).toEqual([]);
      } finally {
        await context.close();
      }
    },
  );
}

test('les rubriques complètes restent accessibles au clavier depuis une fiche sans JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(new URL('/mesures/melenchon-retraites-1/', baseURL).href);
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    const data = nav.getByRole('link', { name: 'Données', exact: true });
    await expect(nav.getByRole('link')).toHaveCount(6);
    await expect(
      nav.getByRole('link', { name: 'Mesures et orientations' }),
    ).toHaveAttribute('href', '/mesures/');
    await data.focus();
    await page.keyboard.press('Enter');
    const link = page
      .locator('#menu-donnees')
      .getByRole('link', { name: 'Sondages', exact: true });
    await expect(link).toBeVisible();
    await link.click();
    await expect(
      page.getByRole('heading', { name: 'Sondages', exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
