import { expect, test } from '@playwright/test';
import comptes from '../../src/data/comptes-presidentielle-2022.json' with { type: 'json' };
import candidates from '../../src/data/candidates.json' with { type: 'json' };

test('la recherche CSG, les documents examinés et les absences sont distincts', async ({
  page,
}) => {
  await page.goto('/questions/');
  const search = page.getByRole('searchbox'),
    person = page.getByRole('combobox', { name: 'Candidat', exact: true });
  await expect(person).toHaveValue('');
  await search.fill('suppression de la CSG');
  await expect(page.locator('.q-topic li:visible')).toHaveCount(1);
  await expect(page).toHaveURL(/#q=suppression/);
  const matrix = page.locator('#q-matrix');
  await matrix.locator('summary').click();
  await expect(matrix.locator('tbody tr')).toHaveCount(10);
  await expect(
    matrix.getByRole('row', { name: /Gabriel Attal/ }),
  ).toContainText('Déclaration');
  await expect(matrix.getByRole('row', { name: /Clara Egger/ })).toContainText(
    'Document examiné',
  );
  await matrix.getByRole('button', { name: 'Candidats suivants' }).click();
  await expect(matrix.locator('#q-p-span')).toContainText('11 à 20');
  await person.selectOption('attal');
  await expect(matrix.locator('tbody tr')).toHaveCount(1);
  const go = page.locator('.q-topic li:visible a');
  await go.focus();
  await go.press('Enter');
  await expect(page).toHaveURL(
    /\/questions\/fiscalite-csg-salaires\/#candidat-attal$/,
  );
  await expect(page.locator('.q-answer')).toHaveCount(3);
  const attal = page.locator('#candidat-attal');
  await expect(attal).toContainText('Supprimer la CSG sur les salaires');
  await attal.locator('summary').click();
  await expect(
    attal.getByRole('link', { name: /LCI/ }).first(),
  ).toHaveAttribute('href', /tf1info.fr/);
  await expect(page.locator('#revue-egger')).toContainText('28 pages');
  await expect(page.locator('#couverture details')).toContainText(
    `${candidates.length - 3} candidats sans fiche`,
  );
});

test('les filtres se relisent dans le lien et la matrice reste lisible à 320 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/questions/#theme=numerique&candidat=attal&etat=manquantes');
  await expect(
    page.getByRole('combobox', { name: 'Couverture', exact: true }),
  ).toHaveValue('manquantes');
  await expect(page.locator('.q-topic li:visible').first()).toContainText(
    'Sans fiche reliée',
  );
  await page.getByRole('button', { name: 'Effacer' }).click();
  await expect(
    page.getByRole('combobox', { name: 'Candidat', exact: true }),
  ).toHaveValue('');
  await page.locator('#q-matrix summary').click();
  await page.getByRole('button', { name: 'Questions suivantes' }).click();
  await expect(page.locator('#q-m-span')).toContainText('3 à 4');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.goto('/questions/#q=choseintrouvable');
  await expect(page.locator('#q-empty')).toBeVisible();
  await expect(page.locator('#q-matrix')).toBeHidden();
});
test('les positions agricoles gardent leur auteur et leur périmètre', async ({
  page,
}) => {
  await page.goto('/questions/agriculture-elevages/');
  await expect(page.locator('#candidat-lassalle')).toContainText(
    'exploitations à taille humaine',
  );
  await expect(page.locator('#candidat-markovic')).toContainText(
    'Parti animaliste',
  );
  await expect(page.locator('#candidat-markovic .q-byline')).toHaveCount(2);
  await page.goto('/questions/agriculture-ogm/');
  await expect(page.locator('#candidat-durif')).toContainText(
    'ne détaille pas les usages concernés',
  );
  await expect(page.locator('#candidat-melenchon')).toContainText(
    'nouvelles techniques génomiques',
  );
});
test('les thèmes et les sources des questions sont consultables sans JavaScript', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  try {
    await page.goto('http://127.0.0.1:4321/questions/');
    await page.locator('[data-theme="fiscalite"] summary').click();
    await page
      .getByRole('link', { name: /Faut-il baisser ou supprimer la CSG/ })
      .click();
    await expect(page.locator('#couverture')).toContainText(
      String(candidates.length - 3),
    );
  } finally {
    await ctx.close();
  }
});
test('les comptes définitifs de 2022 concordent à l’euro avec le tableau de la CNCCFP et le CSV', async ({
  page,
  request,
}) => {
  await page.goto('/argent-des-campagnes/');
  await expect(page.locator('.account-directory article')).toHaveCount(12);
  expect(
    ['depensesDeclarees', 'depensesRetenues', 'remboursement'].map((k) =>
      comptes.reduce((total, c) => total + c[k as 'remboursement'], 0),
    ),
  ).toEqual([83487411, 81085886, 42192172]);
  const file = await request.get('/api/comptes-presidentielle-2022-csv.txt');
  expect(file.ok()).toBeTruthy();
  const rows = (await file.text()).trim().split(/\r?\n/).slice(1);
  expect(rows.map((line) => line.split(';').slice(0, 5))).toEqual(
    comptes.map((c) => [
      '2022',
      c.candidat,
      ...[c.depensesDeclarees, c.depensesRetenues, c.remboursement].map(String),
    ]),
  );
  expect(rows.every((line) => line.endsWith('.pdf#page=35'))).toBeTruthy();
});
