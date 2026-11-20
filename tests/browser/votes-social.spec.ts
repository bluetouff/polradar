import { openDossier } from './dossier-directory';
import { test, expect } from '@playwright/test';
import legislativeVotes from '../../src/data/legislative-votes.json' with { type: 'json' };
import { socialImages } from '../../src/lib/social-images.mjs';

test('les thèmes, les sources et la recherche utilisent la largeur disponible', async ({
  page,
}) => {
  for (const [width, minimum] of [
    [1440, 3],
    [390, 1],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, grid] of [
      ['/themes/fiscalite/', '.measure-list'],
      ['/recherche/?q=retraites', '.advanced-results'],
      ['/sources/', '.sources-grid'],
    ]) {
      await page.goto(route);
      if (route === '/themes/fiscalite/') {
        await expect(
          page.locator('[data-scope="campagne"] .measure-author img').first(),
        ).toBeVisible();
        await expect(
          page.locator('[data-scope="parti"] .measure-author'),
        ).toHaveCount(0);
        const reference = page
          .locator('.measure-links a[href$="#sources"]')
          .first();
        await expect(reference).toHaveText(/\d+ sources?/);
        await reference.click();
        await expect(page.locator('#sources')).toHaveText('Références');
        await page.goBack();
      }
      const columns = await page
        .locator(grid)
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
        );
      if (width === 390) expect(columns).toBe(1);
      else expect(columns).toBeGreaterThanOrEqual(minimum);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
});

test('la frise conserve les objets des motions, les sources et les liens directs', async ({
  page,
}) => {
  await page.goto('/votes/');
  await expect(page.locator('[data-vote-case]:visible')).toHaveCount(0);
  await expect(page.locator('.subject-card:visible')).toHaveCount(12);
  await expect(page.locator('.subject-card')).toHaveCount(
    legislativeVotes.cases.length,
  );
  await openDossier(page, '[data-vote-tab="melenchon-isf"]');
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
  await openDossier(page, '[data-vote-tab="roussel-retraites"]');
  await expect(page.locator('[data-vote-case]:visible')).toContainText(
    'Pour la motion',
  );
  await expect(page.locator('[data-vote-case]:visible')).toContainText(
    'Majorité requise : 287',
  );
  await expect(
    page.locator('[data-vote-case]:visible .ballot-tally > span'),
  ).toHaveCount(1);
  const dots = page.locator('[data-vote-case]:visible .ballot-chart svg path');
  await expect(dots).toHaveCount(1);
  expect((await dots.getAttribute('d'))?.match(/M\d+ \d+h0/g)).toHaveLength(
    278,
  );
  await page.reload();
  await expect(
    page.locator('[data-vote-tab="roussel-retraites"]'),
  ).toHaveAttribute('aria-current', 'true');
  await page.goto('/votes/#dossier=%3Cimg%20src=x%20onerror=alert(1)%3E');
  await expect(page.locator('[data-vote-case]:visible')).toHaveCount(0);
  await expect(page.locator('[data-votes-workspace] img[src="x"]')).toHaveCount(
    0,
  );
});

test('les votes restent accessibles sans JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/votes/');
  await expect(page.locator('.subject-card:visible')).toHaveCount(
    legislativeVotes.cases.length,
  );
  await page.locator('[data-vote-tab="melenchon-isf"]').click();
  await expect(page.locator('[data-vote-case]:visible')).toHaveCount(1);
  await expect(page.locator('.vote-proposal')).toHaveCount(
    legislativeVotes.cases.length,
  );
  await page
    .locator('[data-vote-case]:visible .vote-source summary')
    .first()
    .click();
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
