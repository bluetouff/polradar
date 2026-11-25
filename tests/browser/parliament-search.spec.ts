import { expect, test } from '@playwright/test';
import type { ActIndex } from '../../src/lib/parliament-search-types';

test('un scrutin européen ouvre le texte soumis et le point exact du procès-verbal', async ({
  page,
}) => {
  await page.goto('/votes/recherche/?query=MTG-PL-2024-03-13-DEC-166051');
  const card = page.locator('[data-act-list] article');
  await expect(card).toHaveCount(1);
  await expect(
    card.getByRole('link', { name: 'Dossier et scrutin' }),
  ).toHaveAttribute(
    'href',
    /\/votes\/dossiers\/.*#scrutin-pe9-20240313-intelligence-artificielle$/,
  );
  await card.getByText('Textes et procès-verbaux', { exact: true }).click();
  await expect(
    card.getByRole('link', { name: 'Point du procès-verbal' }),
  ).toHaveAttribute(
    'href',
    'https://data.europarl.europa.eu/eli/dl/doc/PV-9-2024-03-13-RCV-ITM-003',
  );
  await expect(
    card.getByRole('link', { name: 'Texte soumis au vote' }).first(),
  ).toHaveAttribute(
    'href',
    /^https:\/\/data\.europarl\.europa\.eu\/eli\/dl\/doc\//,
  );
});

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
  await expect(page).toHaveURL(/#query=CETA&candidat=melenchon/u);
  expect(new URL(page.url()).search).toBe('');
  await page.reload();
  await expect(result).toHaveCount(1);
  await page
    .getByRole('combobox', { name: 'Vote enregistré', exact: true })
    .selectOption('pour');
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Aucun résultat.');
  await page.goBack();
  await expect(result).toHaveCount(1);
  await expect(page.getByLabel('Sujet ou identifiant')).toHaveValue('CETA');
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

test('le thème Numérique filtre les actes et reste sélectionné au rechargement', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/votes/recherche/');
  await page.getByLabel('Sujet ou identifiant').fill('VTANR5L17V9916');
  const theme = page.getByRole('combobox', { name: 'Thème', exact: true });
  await theme.focus();
  await expect(theme).toBeFocused();
  await theme.selectOption({ label: 'Numérique' });
  await expect(theme).toHaveValue('numerique');
  const search = page.getByRole('button', {
    name: 'Rechercher',
    exact: true,
  });
  await search.press('Enter');
  await expect(page).toHaveURL(/theme=numerique/u);
  const cyber = page
    .locator('[data-act-list] article')
    .filter({ hasText: 'renforcement de la cybersécurité' });
  const official = cyber.getByRole('link', { name: 'Document officiel' });
  await expect(official).toHaveAttribute(
    'href',
    'https://www.assemblee-nationale.fr/dyn/17/scrutins/9916',
  );
  await page.reload();
  await expect(theme).toHaveValue('numerique');
  await expect(official).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);

  const json = await request.get('/api/parlement/recherche.json');
  expect(json.ok()).toBe(true);
  const { actes, themes }: ActIndex = await json.json();
  expect(themes.numerique).toBe('Numérique');
  for (const id of [
    'VTANR5L17V9916',
    'sen2017-98-donnees',
    'MTG-PL-2024-03-13-DEC-166051',
  ]) {
    expect(actes.find((act) => act.id === id)?.themes).toContain('numerique');
  }
  const elan = actes.find((act) => act.id === 'VTANR5L15V928');
  expect(elan).toBeDefined();
  expect(elan?.themes).toContain('logement');
  expect(elan?.themes).not.toContain('numerique');
});
