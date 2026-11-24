import { testOrigin } from './origin';
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
    if (!r.url().startsWith(`${testOrigin}/`)) external.push(r.url());
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

test('les uniques et les référents externes sont visibles ensemble sans additionner les uniques des sites', async ({
  page,
}) => {
  const data = structuredClone(fixture);
  data.all = {
    ...view,
    requests: 20,
    dailyProfiles: 5,
    bytes: 200,
    panels: {
      ...panel,
      visitors: [
        { ...row('2026-11-17', 8), profiles: 2 },
        { ...row('2026-11-18', 12), profiles: 3 },
      ],
      referring_sites: [
        { ...row('example.org', 8), profiles: 3 },
        { ...row('t.co', 6), profiles: 2 },
        row('polradar.fr', 4),
        row('WWW.POLRADAR.FR', 1),
        row('(référent non retenu)', 1),
      ],
    },
  };
  data.firstDate = '2026-11-17';
  await statsFixture(page, data);
  await expect(page.locator('#metrics article').first()).toContainText(
    'Visiteurs uniques',
  );
  await expect(
    page.locator('#metrics article').first().locator('strong'),
  ).toHaveText('5');
  await expect(page.locator('#metrics article').first()).toContainText(
    'Cumul des uniques journaliers',
  );
  await expect(
    page.locator('#metrics article').nth(2).locator('strong'),
  ).toHaveText('2');
  await expect(page.locator('#daily-title')).toHaveText(
    'Visiteurs uniques par jour',
  );
  await expect(page.locator('#daily-chart strong')).toHaveText(['2', '3']);
  await expect(page.locator('#referral-table thead')).toContainText('Uniques');
  await expect(page.locator('#referral-table tbody tr')).toHaveCount(2);
  await expect(
    page.locator('#referral-table tbody tr').first().locator('td'),
  ).toHaveText(['8', '3']);
  await expect(page.locator('#referral-table')).not.toContainText(
    'polradar.fr',
  );
  await page.locator('#referral-other summary').click();
  await expect(page.locator('#referral-other')).toContainText(
    'WWW.POLRADAR.FR',
  );
  await page.locator('#daily-metric').selectOption('hits');
  await expect(page.locator('#daily-title')).toHaveText('Requêtes par jour');
  await expect(page.locator('#daily-chart strong')).toHaveText(['8', '12']);
});

test('tous les sites référents du relevé sont consultables au-delà des vingt premières lignes', async ({
  page,
}) => {
  const data = structuredClone(fixture);
  data.all = {
    ...view,
    requests: 35,
    dailyProfiles: 4,
    panels: {
      ...panel,
      visitors: [{ ...row('2026-11-18', 35), profiles: 4 }],
      referring_sites: Array.from({ length: 35 }, (_, i) =>
        row(`site${i}.example.org`, 1),
      ),
    },
  };
  await statsFixture(page, data);
  await expect(
    page.locator('#metrics article').first().locator('strong'),
  ).toHaveText('4');
  await expect(page.locator('#referral-table tbody tr')).toHaveCount(20);
  await page.locator('#referral-more').click();
  await expect(page.locator('#referral-table tbody tr')).toHaveCount(35);
  await expect(page.locator('#referral-more')).toBeHidden();
  await page.locator('#scope').selectOption('withoutKnownBots');
  await expect(page.locator('#referral-table')).toContainText(
    'Aucun site externe recensé',
  );
  await expect(
    page.locator('#metrics article').first().locator('strong'),
  ).toHaveText('0');
});

test('un cumul incohérent ou une date dupliquée ne produit pas un nombre de visiteurs de remplacement', async ({
  page,
}) => {
  for (const kind of ['total', 'duplicate']) {
    const data = structuredClone(fixture);
    if (kind === 'total') data.all.dailyProfiles = 2;
    else data.all.panels.visitors.push(data.all.panels.visitors[0]);
    await statsFixture(page, data);
    await expect(page.locator('#report')).toBeHidden();
    await expect(page.locator('#feedback')).toContainText(
      kind === 'total'
        ? 'Total quotidien incohérent'
        : 'Dates quotidiennes incohérentes',
    );
    await expect(page.locator('#metrics')).toBeEmpty();
    await page.unroute('**/stats-qa/**');
  }
});

async function statsFixture(
  page: import('@playwright/test').Page,
  data: typeof fixture,
) {
  await page.route('**/stats-qa/**', async (route) => {
    const file =
      new URL(route.request().url()).pathname.split('/').at(-1) || 'index.html';
    if (file === 'report.json')
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(data),
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
}
