import { expect, test } from '@playwright/test';

test('le manifeste et les icônes sont servis localement', async ({
  page,
  request,
  context,
}) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.json',
  );
  await expect(
    page.locator('meta[http-equiv="content-security-policy"]'),
  ).toHaveAttribute('content', /(?:^|;)manifest-src 'self';/);
  const session = await context.newCDPSession(page);
  const response = await session.send('Page.getAppManifest');
  expect(response.errors).toEqual([]);
  expect(response.url).toContain('/manifest.json');
  const manifest = JSON.parse(response.data!);
  expect(manifest).toMatchObject({
    name: 'Polradar',
    start_url: '/',
    display: 'standalone',
    shortcuts: [{ name: 'Fiche hors ligne', url: '/hors-ligne/v1/' }],
  });
  for (const icon of manifest.icons) {
    const data = await request.get(icon.src);
    expect(data.ok()).toBeTruthy();
    expect(data.headers()['content-type']).toContain('image/png');
    const bytes = await data.body();
    const declared = Number(icon.sizes.split('x')[0]);
    expect(bytes.readUInt32BE(16)).toBe(declared);
    expect(bytes.readUInt32BE(20)).toBe(declared);
  }
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length,
    ),
  ).toBe(0);
});

test('les guides anglais mènent aux données de la même édition', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.getByRole('heading', { name: 'French presidential election 2027' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Open data and MCP/ }).click();
  const build = await request.get('/build.json').then((r) => r.json());
  await expect(
    page.getByRole('link', { name: 'Download this edition (.tar.gz)' }),
  ).toHaveAttribute(
    'href',
    `https://github.com/bluetouff/polradar/releases/download/site-${build.sourceCommit}/corpus-v1.tar.gz`,
  );
});
