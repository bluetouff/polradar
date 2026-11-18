import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const row = (label: string, hits: number) => ({
  label,
  hits,
  profiles: 1,
  bytes: 100,
});
const panel = {
  visitors: [row('2026-11-18', 12)],
  requests: [row('/<img src=x onerror=alert(1)>', 12)],
  not_found: [],
  visit_time: [row('13', 12)],
  referring_sites: [row('example.org', 12)],
  browsers: [row('Fixture browser', 12)],
  status_codes: [row('2xx', 12)],
};
const view = { requests: 12, dailyProfiles: 1, bytes: 100, panels: panel };
const fixture = {
  schemaVersion: 1,
  status: 'ready',
  generatedAt: new Date().toISOString(),
  firstDate: '2026-11-18',
  lastDate: '2026-11-18',
  all: view,
  withoutKnownBots: {
    ...view,
    requests: 0,
    dailyProfiles: 0,
    bytes: 0,
    panels: Object.fromEntries(Object.keys(panel).map((k) => [k, []])),
  },
};
const policy =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
test('le lecteur GoAccess fonctionne sous CSP stricte et garde les entrées de journal comme texte', async ({
  page,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4321/')) external.push(r.url());
  });
  await page.route('**/stats-qa/**', async (route) => {
    const file =
      new URL(route.request().url()).pathname.split('/').at(-1) || 'index.html';
    if (file === 'report.json')
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(fixture),
      });
    if (!['index.html', 'viewer.mjs', 'viewer.css'].includes(file))
      return route.abort();
    return route.fulfill({
      headers: { 'Content-Security-Policy': policy },
      contentType: file.endsWith('.mjs')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : 'text/html',
      body: await readFile(
        new URL(`../../deploy/goaccess/${file}`, import.meta.url),
        'utf8',
      ),
    });
  });
  await page.goto('/stats-qa/');
  await expect(page.locator('#report')).toBeVisible();
  await expect(page.locator('#metrics')).toContainText('12');
  await expect(page.locator('img[src=x]')).toHaveCount(0);
  await expect(page.locator('#panels')).toContainText(
    '/<img src=x onerror=alert(1)>',
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.locator('#scope').selectOption('withoutKnownBots');
  await expect(page.locator('#metrics')).toContainText('0');
  await expect(page.locator('#daily-chart')).toContainText(
    'Aucune observation',
  );
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('un rapport absent affiche une erreur, sans indicateur de remplacement', async ({
  page,
}) => {
  await page.route('**/stats-qa/**', async (route) => {
    const file =
      new URL(route.request().url()).pathname.split('/').at(-1) || 'index.html';
    if (file === 'report.json')
      return route.fulfill({ status: 503, body: 'Unavailable' });
    if (!['index.html', 'viewer.mjs', 'viewer.css'].includes(file))
      return route.abort();
    return route.fulfill({
      headers: { 'Content-Security-Policy': policy },
      contentType: file.endsWith('.mjs')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : 'text/html',
      body: await readFile(
        new URL(`../../deploy/goaccess/${file}`, import.meta.url),
        'utf8',
      ),
    });
  });
  await page.goto('/stats-qa/');
  await expect(page.locator('#feedback')).toContainText('Rapport indisponible');
  await expect(page.locator('#report')).toBeHidden();
  await expect(page.locator('#metrics')).toBeEmpty();
});
