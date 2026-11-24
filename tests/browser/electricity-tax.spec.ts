import { test, expect } from '@playwright/test';
const path = '/economie/simulateurs/electricite/';
test('les taxes se calculent localement, au clavier et sur petit écran', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(path);
  const volume = page.getByRole('textbox', {
    name: 'Consommation en kWh par an',
  });
  const out = page.locator('#energy-output');
  await expect(page.locator('#energy-base')).toHaveText(/440,22/);
  await page.getByRole('button', { name: /4.000 kWh/ }).focus();
  await page.keyboard.press('Enter');
  await expect(volume).toHaveValue('4000');
  await expect(page.locator('#power')).toHaveValue('9');
  await expect(page.locator('#energy-base')).toHaveText(/794/);
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await volume.fill('5 000');
  await volume.press('Enter');
  await expect(out.locator('[data-difference]').first()).toHaveText(/111,48/);
  await volume.fill('-4');
  await volume.press('Enter');
  await expect(out).toBeHidden();
  await expect(volume).toBeFocused();
  await expect(volume).toHaveAttribute('aria-invalid', 'true');
  await volume.fill('0');
  await volume.press('Enter');
  await expect(out).toBeVisible();
  await expect(page.locator('#energy-base')).toHaveText(/^0\s*€/);
  expect(requests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('le résultat et ses sources sont lisibles sans JavaScript', async ({
  browser,
  baseURL,
}) => {
  const ctx = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const p = await ctx.newPage();
    await p.goto(path);
    await expect(p.locator('#energy-form')).toBeHidden();
    await expect(p.locator('#energy-output article')).toHaveCount(3);
    await expect(
      p.getByText('Amendement rejeté le 2 novembre 2026', { exact: false }),
    ).toBeVisible();
    await p.getByText('Tarifs, méthode et documents d’origine').click();
    await expect(
      p.getByRole('link', { name: 'Tarif Base (CSV)' }),
    ).toBeVisible();
  } finally {
    await ctx.close();
  }
});
