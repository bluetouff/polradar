import { expect, test } from '@playwright/test';
import events from '../../src/data/events.json' with { type: 'json' };
import votes from '../../src/data/legislative-votes.json' with { type: 'json' };
import evolution from '../../src/data/proposal-evolution.json' with { type: 'json' };
import agenda from '../../src/data/campaign-agenda.json' with { type: 'json' };

test('le retrait quitte les candidatures en cours et conserve le dossier et la brève sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 800 },
  });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4321/candidats/');
    await expect(
      page.locator('#candidate-list a[href="/candidats/ruffin/"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('#candidate-list a[href="/candidats/tondelier/"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('#candidate-list a[href="/candidats/villepin/"]'),
    ).toHaveCount(1);
    await page
      .locator('.withdrawn-registry')
      .getByRole('link', { name: 'François Ruffin' })
      .click();
    await expect(page.locator('.profile-status')).toHaveText(
      'Candidature retirée',
    );
    await page.locator('.candidate-briefs a').click();
    await expect(page.locator('article header time')).toHaveAttribute(
      'datetime',
      '2026-11-22',
    );
    await expect(page.locator('.article-sources a')).toHaveCount(2);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      'content',
      'article',
    );
    await page.locator('.breadcrumbs a').click();
    await expect(page.locator('h1')).toHaveText('Brèves de campagne');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  } finally {
    await context.close();
  }
});

test('la recherche expose chaque dossier de votes, évolution, rendez-vous et brève à sa propre adresse', async ({
  request,
}) => {
  const result = await request.get('/api/recherche.json');
  expect(result.ok()).toBe(true);
  const entries = (await result.json()) as { type: string; url: string }[];
  for (const [type, paths] of [
    ['vote', votes.cases.map((v) => '/votes/#dossier=' + v.id)],
    ['evolution', evolution.tracks.map((v) => '/evolution/#dossier=' + v.id)],
    ['agenda', agenda.events.map((e) => '/agenda/#' + e.id)],
  ] as const) {
    expect(
      entries
        .filter((entry) => entry.type === type)
        .map((entry) => entry.url)
        .sort(),
    ).toEqual(paths.sort());
  }
  expect(entries.filter((e) => e.type === 'breve').map((e) => e.url)).toContain(
    '/breves/francois-ruffin-retrait/',
  );
  const feed = await request.get('/rss/candidats/ruffin.xml');
  expect(await feed.text()).toContain('/breves/francois-ruffin-retrait/');
  const briefsFeed = await request.get('/breves/rss.xml');
  expect(briefsFeed.ok()).toBe(true);
  const xml = await briefsFeed.text();
  const news = entries.filter((entry) => entry.type === 'breve');
  expect(xml.match(/<item>/g)).toHaveLength(news.length);
  for (const article of news) {
    expect(xml).toContain(
      '<link>https://polradar.fr' + article.url + '</link>',
    );
  }
  expect(
    events.some(
      (e) =>
        e.id === 'ruffin-retrait-presidentielle' && e.date === '2026-11-21',
    ),
  ).toBe(true);
});
