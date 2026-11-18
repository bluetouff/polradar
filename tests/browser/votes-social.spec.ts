import { test, expect } from '@playwright/test';
import { socialImages } from '../../src/lib/social-images.mjs';

test('la frise conserve les objets des motions, les sources et les liens directs', async ({
  page,
}) => {
  await page.goto('/votes/');
  await expect(page.locator('[data-vote-case]:visible')).toHaveCount(1);
  const dossier = page.locator('[data-vote-case]:visible');
  await expect(dossier).toContainText('Jean-Luc Mélenchon');
  await expect(dossier.locator('.personal-choice')).toHaveText([
    'Contre l’article',
    'Contre la motion',
  ]);
  await expect(dossier.locator('[data-ballot="an15-1716"]')).toContainText(
    'Motion adoptée',
  );
  await dossier.locator('.vote-source').first().locator('summary').click();
  await expect(dossier.locator('.vote-source[open] a').first()).toHaveAttribute(
    'href',
    'https://www.assemblee-nationale.fr/dyn/15/scrutins/169',
  );
  await page.locator('[data-vote-tab="roussel-retraites"]').click();
  await expect(page.locator('[data-vote-case]:visible')).toContainText(
    'Pour la motion',
  );
  await expect(page.locator('[data-vote-case]:visible')).toContainText(
    'Majorité requise : 287',
  );
  await expect(
    page.locator('[data-vote-case]:visible .ballot-tally > span'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-vote-case]:visible svg[role="img"] circle'),
  ).toHaveCount(278);
  await page.reload();
  await expect(
    page.locator('[data-vote-tab="roussel-retraites"]'),
  ).toHaveAttribute('aria-current', 'true');
  await page.goto('/votes/#dossier=%3Cimg%20src=x%20onerror=alert(1)%3E');
  await expect(page.locator('[data-vote-case]:visible')).toHaveAttribute(
    'data-vote-case',
    'melenchon-isf',
  );
  await expect(page.locator('[data-votes-workspace] img[src="x"]')).toHaveCount(
    0,
  );
});

test('les votes restent accessibles sans JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/votes/');
  await expect(page.locator('[data-vote-case]:visible')).toHaveCount(6);
  await expect(page.locator('.vote-proposal')).toHaveCount(6);
  await page.locator('.vote-source summary').first().click();
  await expect(page.locator('.vote-source[open]')).toHaveCount(1);
  await context.close();
});

test('les cinq liens de partage restent statiques, canoniques et sans appel aux plateformes', async ({
  page,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== 'http://127.0.0.1:4321')
      external.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/votes/?utm_source=secret#dossier=roussel-retraites');
  const links = page.locator('.page-share a');
  await expect(links).toHaveCount(5);
  const hrefs = await links.evaluateAll((nodes) =>
    nodes.map((node) => ({
      href: (node as HTMLAnchorElement).href,
      rel: (node as HTMLAnchorElement).rel,
      referrer: (node as HTMLAnchorElement).referrerPolicy,
    })),
  );
  for (const link of hrefs) {
    const url = new URL(link.href);
    const values = [...url.searchParams.values()].join(' ');
    expect(values).toContain('https://polradar.fr/votes/');
    expect(values).not.toContain('secret');
    expect(values).not.toContain('roussel-retraites');
    expect(link.rel).toContain('noreferrer');
    expect(link.referrer).toBe('no-referrer');
  }
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('chaque rubrique sert ses métadonnées et un PNG OG 1200 × 630', async ({
  page,
  request,
}) => {
  const images = new Set<string>();
  for (const card of socialImages) {
    await page.goto(card.path);
    const url = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content');
    expect(url).toBe('https://polradar.fr' + card.url);
    images.add(url!);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      url!,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    await expect(
      page.locator('meta[property="og:image:width"]'),
    ).toHaveAttribute('content', '1200');
    const response = await request.get(card.url);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const png = await response.body();
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }
  expect(images.size).toBe(socialImages.length);
});

test('la frise et les partages gardent leurs marges de 320 à 1800 pixels', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [320, 390, 768, 1024, 1440, 1800]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      '/votes/#dossier=philippe-retraites',
      '/votes/#dossier=roussel-retraites',
      '/',
    ]) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width} ${route}`,
      ).toBe(true);
      const outside = await page.locator('main svg:visible').evaluateAll(
        (nodes) =>
          nodes.filter((node) => {
            const r = node.getBoundingClientRect();
            return r.left < 0 || r.right > innerWidth + 1;
          }).length,
      );
      expect(outside, `${width} ${route} SVG`).toBe(0);
      const targets = await page
        .locator('.page-share a')
        .evaluateAll((nodes) =>
          nodes.every((node) => node.getBoundingClientRect().height >= 44),
        );
      expect(targets).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
