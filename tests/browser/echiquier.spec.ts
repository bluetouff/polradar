import { test, expect } from '@playwright/test';
import wave from '../../src/data/ches-france-2024.json' with { type: 'json' };
test('les deux plans et le tableau restituent la même enquête', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/echiquier/');
  await expect(page.locator('.plot-societe .map-point:visible')).toHaveCount(
    wave.parties.length,
  );
  await page.getByRole('radio', { name: 'Intégration européenne' }).check();
  await expect(page.locator('.plot-europe')).toBeVisible();
  await expect(page.locator('.plot-societe')).toBeHidden();
  await page.locator('.plot-europe [data-party="602"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#parti-602')).toHaveClass(/selected/);
  await expect(page.locator('#parti-602 td')).toHaveText(['3,4', '2,7', '6,3']);
  for (const w of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width: w, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
});
test('la comparaison sépare parti, candidat et position absente et se partage', async ({
  page,
}) => {
  await page.goto('/echiquier/');
  await page
    .locator('#issue-choice')
    .selectOption('europe-participation-union');
  await page.locator('#profile-choice').selectOption('glucksmann');
  await expect(page.locator('.issue-lane a:visible')).toHaveText(
    /◇\s*Place publique\s*Texte du parti/,
  );
  await expect(page.locator('[data-issue-missing]:visible')).toContainText(
    'Seul le texte du parti',
  );
  await page.reload();
  await expect(page.locator('#profile-choice')).toHaveValue('glucksmann');
  await page.locator('#profile-choice').selectOption('philippot');
  await expect(page.locator('.issue-lane a:visible')).toContainText(
    'Florian Philippot',
  );
  await page.locator('#profile-choice').selectOption('durif');
  await expect(page.locator('[data-issue-missing]:visible')).toContainText(
    'Aucune position documentée',
  );
  await expect(page.locator('.issue-lane a:visible')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('#profile-choice')).toHaveValue('philippot');
});
test('la carte, les textes et les profils se consultent sans JavaScript', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4321/echiquier/');
  await page.getByRole('radio', { name: 'Intégration européenne' }).check();
  await expect(page.locator('.plot-europe')).toBeVisible();
  await page.locator('#question-europe-participation-union summary').click();
  await expect(
    page.locator('#question-europe-participation-union'),
  ).toContainText('Christian Collovati');
  await page.locator('.sheet-atlas summary').click();
  await expect(page.locator('.sheet-grid')).toContainText('Sylvain Durif');
  await ctx.close();
});
