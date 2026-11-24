import { test, expect } from '@playwright/test';
import economy from '../../src/data/economy.json' with { type: 'json' };
import budget from '../../src/data/budget.json' with { type: 'json' };

test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 840 } });

test('les séries économiques et leurs valeurs restent lisibles sans JavaScript', async ({
  page,
  request,
}) => {
  await page.goto('/economie/');
  await expect(
    page.getByRole('heading', { name: 'Indicateurs économiques', level: 1 }),
  ).toBeVisible();
  await expect(page.locator('.economy-card')).toHaveCount(18);
  await page.getByRole('link', { name: 'Inflation harmonisée' }).click();
  await expect(
    page.getByRole('heading', { name: 'Inflation harmonisée', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: /^Inflation harmonisée/ }),
  ).toBeVisible();
  await page.getByText('Toutes les observations', { exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  const response = await request.get('/api/economie.json');
  expect(response.ok()).toBe(true);
  expect((await response.json()).series).toHaveLength(18);
  const downloading = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Données CSV' }).click();
  expect((await downloading).suggestedFilename()).toBe('polradar-economie.csv');
  const csv = await request.get('/api/economie-csv.txt');
  expect(csv.ok()).toBe(true);
  const inflation = economy.series.find((row) => row.id === 'inflation')!;
  const [period, value] = inflation.observations
    .filter((row) => row[1] !== null)
    .at(-1)!;
  expect(await csv.text()).toContain(`inflation;FR;M;${period};${value};%;`);
});

test('les déclarations distinguent concordance, révision et périmètre', async ({
  page,
}) => {
  await page.goto('/economie/declarations/');
  await expect(page.locator('#mercier-dette-2025')).toContainText(
    'Chiffre révisé',
  );
  await expect(
    page.locator('#mercier-dette-2025 .economy-values > div'),
  ).toHaveCount(3);
  await expect(
    page.locator('#attal-echanges-electriques-2025 .economy-values > div'),
  ).toHaveCount(2);
  await expect(page.locator('#farandou-chomage-t3-2026')).toContainText(
    'Concorde',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test('les 18 cartes économiques gardent leurs graduations et le contraste sur leur surface réelle', async ({
  page,
}) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/economie/');
    const ratios = await page
      .locator('.economy-atlas .economy-card')
      .evaluateAll((cards) => {
        const light = (rgb: string) => {
          const channels = rgb
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map((n) => Number(n) / 255)
            .map((v) =>
              v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
            );
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          );
        };
        const ratio = (a: number, b: number) =>
          (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        return cards.map((card) => {
          const style = getComputedStyle(card);
          const bg = light(style.backgroundColor);
          const nodes = card.querySelectorAll(
            'h3 a, .economy-reading > *, p, .economy-scale, figcaption',
          );
          return {
            surface: style.backgroundImage,
            text: Math.min(
              ...Array.from(nodes, (n) =>
                ratio(light(getComputedStyle(n).color), bg),
              ),
            ),
            line: ratio(
              light(
                getComputedStyle(card.querySelector('.economy-line')!).stroke,
              ),
              bg,
            ),
            graduations: card.querySelectorAll('.economy-scale > span').length,
          };
        });
      });
    expect(ratios).toHaveLength(economy.series.length);
    for (const card of ratios) {
      expect(card.surface).toBe('none');
      expect(card.text).toBeGreaterThanOrEqual(4.5);
      expect(card.line).toBeGreaterThanOrEqual(3);
      expect(card.graduations).toBe(2);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});
test('les comptes annuels présentent les flux et la dette avec leur tableau sans script', async ({
  page,
}) => {
  await page.goto('/economie/finances-publiques/');
  await expect(
    page.getByRole('heading', { name: 'Recettes et dépenses de l’année' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Dette en fin d’année' }),
  ).toBeVisible();
  await page.locator('.accounts-values summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('.accounts-values tbody tr')).toHaveCount(
    budget.history.length + 1,
  );
  await expect(page.locator('.accounts-values tbody tr').last()).toContainText(
    (-budget.values.deficit).toLocaleString('fr-FR'),
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
