import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { testOrigin } from './origin';
import votes from '../../src/data/legislative-votes.json' with { type: 'json' };

async function ready(page: Page) {
  await expect(page.locator('#studio-code')).toHaveValue(/<figure>/);
  await expect(page.locator('#studio-img')).toHaveAttribute(
    'src',
    /^data:image\/svg\+xml;base64,/,
  );
}
test('les éditions du Studio gardent leurs chiffres, leurs sources et leurs dimensions', async ({
  page,
  context,
}) => {
  const outbound: string[] = [];
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== testOrigin)
      outbound.push(r.url());
  });
  await page.goto('/studio/#scrutins-an16-1240');
  await ready(page);
  await expect(page.locator('#studio-sources a').first()).toHaveAttribute(
    'href',
    /^https:\/\/.*assemblee-nationale.fr\//,
  );
  const record = votes.ballots.find((b) => b.id === 'an16-1240')!;
  expect(record.tally.against).toBeNull();
  expect(record.tally.abstained).toBeNull();
  await page.getByText('Lire les données en tableau').click();
  await expect(
    page.locator('#studio-table tr').filter({ hasText: 'Contre' }),
  ).toContainText('Non renseigné');
  await page.locator('#studio-shape').selectOption('carre');
  await page.locator('#studio-width').selectOption('640');
  await expect(page.locator('#studio-img')).toHaveAttribute('height', '640');
  const grab = async (name: string) => {
    const waiting = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    const d = await waiting;
    return readFile((await d.path())!);
  };
  const svg = (await grab('SVG')).toString();
  expect(svg).toContain('viewBox');
  expect(svg).toContain('Non publié');
  expect(svg).toContain('CC BY 4.0');
  expect(svg).toContain(record.source.url);
  expect(svg).toContain('width="640"');
  expect(svg).not.toContain('<script');
  const png = await grab('PNG');
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(640);
  expect(png.readUInt32BE(20)).toBe(640);
  const csv = (await grab('CSV')).toString();
  expect(csv).toContain('"Contre";""');
  expect(csv).toContain(record.source.url);
  expect(csv).toContain('278');
  await page.locator('#studio-mode').selectOption('actualisee');
  await expect(page.locator('#studio-code')).toHaveValue(
    /https:\/\/polradar.fr\/graphiques\/studio\/scrutins-an16-1240.svg/,
  );
  const html = (await grab('HTML autonome')).toString();
  expect(html).toContain('data:image/svg+xml;base64,');
  expect(html).not.toContain('<script');
  expect(html).toContain(record.source.url);
  expect(html).toContain('creativecommons.org/licenses/by/4.0/');
  expect(csv).toContain('polradar.fr/licences/');
  const preview = await context.newPage();
  await context.setOffline(true);
  await preview.setContent(html);
  await expect
    .poll(() =>
      preview
        .locator('img')
        .evaluate((im) => (im as HTMLImageElement).naturalWidth),
    )
    .toBe(640);
  expect(outbound).toEqual([]);
});
test('toutes les familles du Studio produisent une figure et des références sur mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 780 });
  await page.goto('/studio/');
  await ready(page);
  const families = await page
    .locator('#studio-family option')
    .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
  expect(families).toEqual(
    expect.arrayContaining([
      'economie',
      'retraites',
      'sondages',
      'fiscalite',
      'budgets',
      'scrutins',
      'evolution',
      'arcom',
      'marches',
    ]),
  );
  for (const f of families) {
    await page.locator('#studio-family').selectOption(f);
    const id = await page
      .locator('#studio-item option')
      .evaluateAll((options) =>
        options.map((o) => (o as HTMLOptionElement).value).find(Boolean)!,
      );
    await page.locator('#studio-item').selectOption(id);
    await ready(page);
    await expect(page.locator('#studio-sources a').first()).toHaveAttribute(
      'href',
      /https:/,
    );
    await expect(page.locator('#studio-status')).toBeEmpty();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(376);
  }
});
test('le Studio conserve son catalogue de SVG sans JavaScript', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(testOrigin + '/studio/');
    const menu = page.locator('.studio-noscript details').filter({
      has: page.locator('summary').filter({ hasText: 'Votes parlementaires' }),
    });
    await menu.locator('summary').click();
    const asset = await menu
      .locator('a[download]')
      .first()
      .getAttribute('href');
    const response = await request.get(asset!);
    expect(response.ok()).toBeTruthy();
    expect(await response.text()).toContain('<svg');
  } finally {
    await context.close();
  }
});
