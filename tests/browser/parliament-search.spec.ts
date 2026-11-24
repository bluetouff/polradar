import { expect, test } from '@playwright/test';

test('chercher un scrutin européen, retrouver les trois votes et partager les filtres', async ({
  page,
}) => {
  await page.goto('/votes/');
  await page
    .getByRole('link', { name: 'Rechercher un scrutin ou un texte' })
    .click();
  await page.getByLabel('Sujet ou identifiant').fill('CETA');
  await page
    .getByRole('combobox', { name: 'Institution', exact: true })
    .selectOption('parlement-europeen');
  await page
    .getByRole('combobox', { name: 'Candidat', exact: true })
    .selectOption('melenchon');
  await page
    .getByRole('combobox', { name: 'Vote enregistré', exact: true })
    .selectOption('contre');
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
  const result = page.locator('[data-act-list] article');
  await expect(result).toHaveCount(1);
  for (const name of [
    'Marine Le Pen',
    'Jean-Luc Mélenchon',
    'Florian Philippot',
  ])
    await expect(result).toContainText(name + ' · Contre');
  await expect(
    result.getByRole('link', { name: 'Document officiel' }),
  ).toHaveAttribute('href', /europarl\.europa\.eu\/RegData/);
  await expect(page).toHaveURL(/candidat=melenchon/u);
  await page.reload();
  await expect(result).toHaveCount(1);
  await page
    .getByRole('combobox', { name: 'Vote enregistré', exact: true })
    .selectOption('pour');
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Aucun résultat.');
});
test('pagination, élections distinctes et période des séances recensées', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/votes/recherche/?institution=assemblee');
  await expect(page.locator('[data-act-list] article')).toHaveCount(15);
  const one = await page.locator('[data-act-list] h2').first().textContent();
  await page.getByRole('button', { name: 'Page suivante' }).click();
  await expect(page).toHaveURL(/edition=[0-9a-f]{64}/);
  await expect(page.locator('[data-act-list] h2').first()).not.toHaveText(one!);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto(
    '/votes/recherche/?institution=parlement-europeen&debut=2024-03-13&fin=2024-03-13&candidat=durif',
  );
  await expect(page.getByRole('status')).toContainText(
    'La séance européenne a été examinée',
  );
  await page.goto(
    '/votes/recherche/?institution=parlement-europeen&debut=2020-06-01&fin=2020-06-01&candidat=durif',
  );
  await expect(page.getByRole('status')).toContainText(
    'hors des séances examinées',
  );
});
