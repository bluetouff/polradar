import { expect, test } from '@playwright/test';
import apl from '../../src/data/territoires/apl.json' with { type: 'json' };
import departments from '../../src/data/territoires/departements.json' with { type: 'json' };
test('la paie est calculée sur place sans transmettre ni conserver le salaire', async ({
  page,
}) => {
  await page.goto('/economie/simulateurs/');
  const field = page.getByLabel('Salaire brut mensuel en euros');
  await expect(field).toBeVisible();
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('20000') || r.method() !== 'GET') calls.push(r.url());
  });
  await field.fill('20000');
  await page.getByRole('button', { name: 'Calculer' }).click();
  await expect(page.locator('#salary-total')).toHaveText(/1\s814,21/);
  expect(page.url()).not.toContain('20000');
  await field.fill('2,345');
  await page.getByRole('button', { name: 'Calculer' }).click();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#salary-result')).toBeHidden();
  expect(calls).toEqual([]);
  const stored = await page.evaluate(() => [
    ...Object.values(localStorage),
    ...Object.values(sessionStorage),
  ]);
  expect(stored.join('')).not.toContain('20000');
});
test('le même territoire relie l’offre de soins, le logement et les résultats électoraux', async ({
  page,
}) => {
  await page.setViewportSize({ width: 365, height: 780 });
  await page.goto('/territoires/#commune=97120');
  await expect(page.locator('[data-feedback]')).toContainText('97120');
  await expect(page.locator('[data-place]')).toContainText('Pointe-à-Pitre');
  const expected = apl['97120'].toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  await expect(page.locator('[data-context-field=access] dd')).toHaveText(
    expected,
  );
  const department = departments.find((d) => d.code === '971')!;
  await expect(
    page.locator('[data-context-field=department] dt'),
  ).toContainText(department.name);
  await expect(page.locator('[data-context-field=department] dd')).toHaveText(
    department.value!.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  );
  await expect(
    page.getByRole('link', { name: 'Propositions sur les médecins' }),
  ).toHaveAttribute('href', /commune=97120$/);
  await expect(page.locator('[data-local-election]')).toHaveAttribute(
    'href',
    '/communes/#commune=97120',
  );
  await page.goto('/territoires/#commune=97611');
  await expect(page.locator('[data-feedback]')).toContainText('97611');
  await expect(page.locator('[data-context-field=access] dd')).toHaveText(
    'Non disponible',
  );
  await expect(page.locator('[data-context-field=department] dd')).toHaveText(
    'Non disponible',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(366);
});
