import { expect, test } from '@playwright/test';

const savedKey = 'polradar.follow.saved.v1';

test('une recherche est retrouvée avec ses filtres, et peut être retirée', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const navigations: string[] = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest()) navigations.push(request.url());
  });
  await page.goto('/recherche/');
  await expect(page.locator('#search-save')).toBeHidden();
  const query = page.getByRole('searchbox');
  await query.fill('suppression de la CSG');
  await page.locator('#search-options summary').click();
  await page.locator('select[name=candidate]').selectOption('attal');
  await page.locator('select[name=theme]').selectOption('fiscalite');
  await expect(page.locator('#search-results')).toContainText('CSG');
  const save = page.getByRole('button', { name: 'Enregistrer la recherche' });
  await save.click();
  await expect(page.locator('#search-count')).toContainText(
    'enregistrée dans Mon suivi',
  );
  await save.click();
  await expect(page.locator('#search-count')).toContainText(
    'déjà dans Mon suivi',
  );
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Mon suivi' })
    .click();
  const section = page.locator('#saved-views');
  await expect(section.locator('li')).toHaveCount(1);
  await page.reload();
  await section.getByRole('link', { name: /CSG.*Gabriel Attal/ }).click();
  await expect(query).toHaveValue('suppression de la CSG');
  await expect(page.locator('select[name=candidate]')).toHaveValue('attal');
  await expect(page.locator('select[name=theme]')).toHaveValue('fiscalite');
  await expect(page.locator('#search-results')).toContainText('CSG');
  expect(navigations.every((address) => !new URL(address).search)).toBe(true);
  await page.goBack();
  const remove = section.getByRole('button', {
    name: /Retirer.*suppression de la CSG/,
  });
  await remove.click();
  await expect(section).toBeHidden();
  await expect(page.locator('#follow-clear')).toBeFocused();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), savedKey),
  ).toBeNull();
});

test('une comparaison privée conserve la question et les choix puis s’efface avec Mon suivi', async ({
  page,
  context,
}) => {
  const follow = await context.newPage();
  await follow.goto('/suivi/');
  const followed = follow.locator(
    '[data-follow-kind=candidate][data-follow-id=attal]',
  );
  await followed.click();
  await expect(followed).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/comparer/');
  await page.locator('#compare-theme').selectOption('fiscalite');
  await page.locator('#compare-archives').check();
  await page.locator('#compare-third').check();
  await page.locator('#compare-candidate-0').selectOption('attal');
  await page.locator('#compare-candidate-1').selectOption('glucksmann');
  await page
    .locator('#compare-question')
    .selectOption('fiscalite-csg-salaires');
  await expect(page.locator('#comparison-cards')).toHaveAttribute(
    'data-count',
    '2',
  );
  await expect(page.locator('#comparaison-attal')).toContainText('CSG');
  await page
    .getByRole('button', { name: 'Enregistrer la comparaison' })
    .click();
  await expect(page.locator('#comparison-feedback')).toContainText(
    'enregistrée dans Mon suivi',
  );

  const saved = follow.locator('#saved-views');
  const link = saved.getByRole('link', {
    name: /Comparaison.*revenus du travail.*Gabriel Attal.*Raphaël Glucksmann/,
  });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /^\/comparer\/#comparaison\?/);
  const navigations: URL[] = [];
  follow.on('request', (request) => {
    if (request.isNavigationRequest()) navigations.push(new URL(request.url()));
  });
  await link.click();
  await expect(follow.locator('#compare-question')).toHaveValue(
    'fiscalite-csg-salaires',
  );
  await expect(follow.locator('#compare-candidate-0')).toHaveValue('attal');
  await expect(follow.locator('#compare-candidate-1')).toHaveValue(
    'glucksmann',
  );
  await expect(follow.locator('#compare-candidate-2')).toBeVisible();
  await follow
    .getByRole('navigation', { name: 'Candidats comparés' })
    .getByRole('link', { name: 'Gabriel Attal' })
    .click();
  await expect(follow.locator('#comparaison-attal')).toBeFocused();
  await expect(follow).toHaveURL(/#comparaison\?/);
  await follow.locator('#compare-question').selectOption('');
  await expect(follow.locator('#compare-theme')).toHaveValue('fiscalite');
  await expect(follow.locator('#compare-archives')).toBeChecked();
  await follow.reload();
  await expect(follow.locator('#compare-candidate-0')).toHaveValue('attal');
  await expect(follow.locator('#compare-archives')).toBeChecked();
  expect(navigations.every(({ search }) => !search)).toBe(true);

  await follow.goto('/suivi/');
  await expect(followed).toHaveAttribute('aria-pressed', 'true');
  await follow.locator('#follow-clear').click();
  await expect(saved).toBeHidden();
  await expect(followed).toHaveAttribute('aria-pressed', 'false');
  expect(
    await follow.evaluate(
      (key) => [
        localStorage.getItem(key),
        localStorage.getItem('polradar.follow.v1'),
      ],
      savedKey,
    ),
  ).toEqual([null, null]);
});

test('Mon suivi relit seulement les champs prévus et affiche les titres comme texte', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify([
        {
          kind: 'compare',
          parameters: 'c=attal',
          title: 'Comparaison incomplète',
        },
        { kind: 'other', parameters: 'q=test', title: 'Type inconnu' },
        {
          kind: 'search',
          parameters: 'q=conditions+de+départ&page=9&site=hors-corpus',
          title: 'Âge <repère> & conditions',
        },
      ]),
    );
  }, savedKey);
  await page.goto('/suivi/');
  const saved = page.locator('#saved-views');
  await expect(saved.locator('li')).toHaveCount(1);
  const link = saved.getByRole('link', { name: /Âge <repère> & conditions/ });
  await expect(link).toHaveAttribute(
    'href',
    '/recherche/#q=conditions+de+d%C3%A9part',
  );
  await expect(saved.locator('repère')).toHaveCount(0);
});

test('un stockage indisponible produit un état explicite sans fausse confirmation', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Quota', 'QuotaExceededError');
      return set.call(this, name, value);
    };
  }, savedKey);
  await page.goto('/recherche/');
  await page.getByRole('searchbox').fill('retraites');
  await page.getByRole('button', { name: 'Enregistrer la recherche' }).click();
  await expect(page.locator('#search-count')).toContainText(
    'n’a pas été enregistrée',
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), savedKey),
  ).toBeNull();
});
