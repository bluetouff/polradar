import { expect, test } from '@playwright/test';

test('les neuf outils sont accessibles depuis Mon quotidien sur mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/economie/simulateurs/');
  await expect(
    page.getByRole('heading', { name: 'Mon quotidien' }),
  ).toBeVisible();
  await expect(page.locator('[data-simulator-card]')).toHaveCount(9);
  await page.getByRole('link', { name: /Droits de succession/ }).click();
  await expect(page).toHaveURL(/\/economie\/simulateurs\/successions\/$/);
  await expect(
    page.getByRole('heading', { name: 'Droits de succession' }),
  ).toBeVisible();
  const share = page.getByRole('textbox', { name: /Part nette reçue/ });
  await expect(share).toBeVisible();
  await expect(page.locator('[data-simulator-amount]').first()).toHaveText(
    /8\s*194,35/,
  );
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') writes.push(request.method());
  });
  await share.fill('-1');
  await share.press('Enter');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(share).toHaveAttribute('aria-invalid', 'true');
  await expect(share).toBeFocused();
  await expect(page.locator('[data-simulator-results]')).toBeHidden();
  await share.fill('100 000');
  await share.press('Enter');
  await expect(page.locator('[data-simulator-amount]').first()).toHaveText(
    /^0\s*€/,
  );
  await expect(page.getByText('Non chiffrable', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  await expect(page).toHaveURL(/\/successions\/$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('un calcul et ses sources restent lisibles sans JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    await page.goto('/economie/simulateurs/carburants/');
    await expect(page.locator('[data-household]')).toBeHidden();
    await expect(page.locator('[data-simulator-row]')).toHaveCount(5);
    await expect(page.locator('[data-simulator-amount]').first()).toHaveText(
      /78,06/,
    );
    await expect(
      page.getByText('Amendement rejeté le 2 novembre 2026'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /DGEC/ })).toHaveAttribute(
      'href',
      /#page=6$/,
    );
  } finally {
    await context.close();
  }
});

test('le temps de travail distingue les durées générales et les propositions ciblées', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/economie/simulateurs/temps-de-travail/');
  const weeks = page.getByRole('textbox', { name: 'Semaines travaillées' });
  await weeks.fill('2');
  await weeks.press('Enter');
  const calculated = page.locator('[data-simulator-results]');
  await expect(
    calculated.locator('[data-simulator-amount]').first(),
  ).toHaveText('70 h');
  await expect(
    calculated.getByRole('heading', { name: 'Gilles Platret' }),
  ).toBeVisible();
  await expect(calculated.getByText('32 heures')).toHaveCount(0);

  await page
    .getByRole('link', { name: /autres propositions documentées/ })
    .click();
  const positions = page.getByRole('region', {
    name: 'Durées ciblées et autres propositions',
  });
  await expect(
    positions.getByRole('heading', { name: 'Jean-Luc Mélenchon' }),
  ).toBeVisible();
  await expect(
    positions.getByText(/32 heures pour les métiers pénibles ou de nuit/),
  ).toBeVisible();
  await expect(
    positions.getByRole('heading', { name: 'Édouard Philippe' }),
  ).toBeVisible();
  await expect(
    positions.getByRole('heading', { name: 'Parti socialiste' }),
  ).toBeVisible();
  await expect(
    positions.getByRole('link', {
      name: /semaine en quatre jours à nombre d’heures mensuelles constant/,
    }),
  ).toHaveAttribute(
    'href',
    '/mesures/attal-semaine-quatre-jours-heures-mensuelles/',
  );
});

test('le thème expression montre le statut et le passage officiel du DSA', async ({
  page,
}) => {
  await page.goto('/numerique/');
  await page
    .getByRole('link', { name: /Liberté d’expression/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/numerique\/liberte-expression\/$/);
  await page.getByRole('link', { name: /DSA et modération/ }).click();
  const card = page.locator('article').filter({ hasText: 'Contester le DSA' });
  await expect(card.getByText('Les Patriotes', { exact: true })).toBeVisible();
  await expect(
    card.getByRole('link', { name: /Document du parti/ }),
  ).toHaveAttribute('href', /^https:\/\/les-patriotes\.fr\/.+#page=12$/);
  await page
    .getByText('Repères sur le DSA et la liberté d’expression', { exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: /Déclaration de 1789/ }),
  ).toBeVisible();
});
