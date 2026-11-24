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
