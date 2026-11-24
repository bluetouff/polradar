import { expect, test } from '@playwright/test';

test('réinitialiser la matrice restaure le total et retire le document de l’URL', async ({
  page,
  request,
}) => {
  const { records } = await (
    await request.get('/api/couverture-documentaire.json')
  ).json();
  const source = 'dlf-economie-2026';
  const filtered = records.filter((r: { documents: string[] }) =>
    r.documents.includes(source),
  );
  expect(filtered.length).toBeGreaterThan(0);
  expect(filtered.length).toBeLessThan(records.length);
  await page.goto('/documents/couverture/#document=' + source);
  const count = page.locator('[data-count="measures"]');
  await expect(count).toHaveText(String(filtered.length));
  await page.getByRole('button', { name: 'Tout afficher' }).click();
  await expect(page.getByLabel('Document cité')).toHaveValue('');
  await expect(count).toHaveText(String(records.length));
  await expect(page).toHaveURL(/\/documents\/couverture\/$/);
});

test('les facettes conservent quatre types de fiche et la provenance par thème', async ({
  page,
  request,
}) => {
  const { records } = await (
    await request.get('/api/couverture-documentaire.json')
  ).json();
  const candidate = 'melenchon';
  const selected = records.filter(
    (row: { candidate: string; theme: string }) =>
      row.candidate === candidate && row.theme === 'retraites',
  );
  expect(selected.length).toBeGreaterThan(0);
  await page.setViewportSize({ width: 320, height: 750 });
  await page.goto('/documents/couverture/#candidate=' + candidate);
  const theme = page.locator('.matrix-bars > [data-theme="retraites"]');
  await expect(theme.locator('[data-theme-total]')).toHaveText(
    String(selected.length),
  );
  for (const scope of ['campagne', 'parti', 'orientation', 'archive']) {
    const count = selected.filter(
      (row: { scope: string }) => row.scope === scope,
    );
    await expect(
      theme.locator('[data-theme-count="' + scope + '"]'),
    ).toHaveText(String(count.length));
  }
  const refs = new Set(
    selected.flatMap((row: { documents: string[] }) => row.documents),
  );
  await expect(theme.locator('[data-theme-count="documents"]')).toHaveText(
    String(refs.size),
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
