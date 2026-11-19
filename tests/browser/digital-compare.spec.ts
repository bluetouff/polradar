import { test, expect } from '@playwright/test';

test('le comparatif numérique sélectionne des profils distincts et conserve le lien', async ({
  page,
  baseURL,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== baseURL) external.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/numerique/');
  await expect(
    page.getByText(
      /\d+ propositions dans les documents de \d+ profils suivis\./,
    ),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Comparatif du numérique' })
    .getByRole('link', { name: 'Cybersécurité ↗' })
    .click();
  await expect(page).toHaveURL(/\/numerique\/comparer\/$/);
  const first = page.locator('[data-digital-cells]').first();
  await expect(
    first.locator(
      '[data-digital-profile]:visible .digital-decision-byline > a',
    ),
  ).toHaveText(['Édouard Philippe', 'Bruno Retailleau', 'Fabien Roussel']);
  const input = page.getByLabel('Profil 1');
  await expect(input.locator('option[value="retailleau"]')).toBeDisabled();
  await input.selectOption('dupont-aignan');
  await expect(
    first.locator(
      '[data-digital-profile]:visible .digital-decision-byline > a',
    ),
  ).toHaveText(['Nicolas Dupont-Aignan', 'Bruno Retailleau', 'Fabien Roussel']);
  await expect(
    first.locator('[data-digital-profile="dupont-aignan"]'),
  ).toContainText('Document du parti');
  await expect(page.locator('.digital-decision-numbers dd:visible')).toHaveText(
    /2,3\sMd€ sur le mandat/,
  );
  await expect(page).toHaveURL(
    /#profils=dupont-aignan%2Cretailleau%2Croussel$/,
  );
  await page.reload();
  await expect(input).toHaveValue('dupont-aignan');
  await page.goto(
    '/numerique/comparer/#profils=retailleau,retailleau,%3Csvg%3E',
  );
  await expect(input).toHaveValue('philippe');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('le chiffrement attribue le vote au retrait de l’article et les interventions à leurs auteurs', async ({
  page,
}) => {
  await page.goto('/numerique/comparer/chiffrement/');
  await expect(page.locator('.digital-axis-tabs [aria-current]')).toHaveText(
    'Chiffrement',
  );
  await expect(
    page.locator('[data-digital-profile="tondelier"]'),
  ).toContainText('Projet de parti');
  await expect(page.locator('.encryption-ballot figcaption')).toHaveText(
    'Scrutin n° 9794 · 107 votants',
  );
  await expect(page.locator('.encryption-ballot li')).toHaveText([
    '69 Pour le retrait',
    '37 Contre le retrait',
    '1 Abstention',
  ]);
  const bars = await page
    .locator('.encryption-ballot svg rect')
    .evaluateAll((rows) =>
      rows.map((rect) => [
        Number(rect.getAttribute('x')),
        Number(rect.getAttribute('width')),
      ]),
    );
  expect(bars).toHaveLength(3);
  expect(bars[0][1]).toBeCloseTo((69 / 107) * 100);
  expect(bars[2][0] + bars[2][1]).toBeCloseTo(100);
  await expect(
    page
      .locator('.encryption-statements')
      .getByText('Emeric Salmon · Débat à l’Assemblée'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Scrutin officiel ↗' }),
  ).toHaveAttribute(
    'href',
    'https://www.assemblee-nationale.fr/dyn/17/scrutins/9794',
  );
  await page.locator('.encryption-earlier summary').click();
  await expect(
    page.getByRole('link', { name: 'Loi promulguée ↗' }),
  ).toBeVisible();
});

test('les trois axes restent lisibles sans JavaScript à 320 pixels', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 850 },
  });
  const page = await context.newPage();
  for (const slug of ['', 'chiffrement/', 'souverainete/']) {
    await page.goto(new URL(`/numerique/comparer/${slug}`, baseURL).href);
    await expect(
      page
        .locator('[data-digital-cells]')
        .first()
        .locator('[data-digital-profile]:visible'),
    ).toHaveCount(3);
    await expect(page.locator('#digital-profile-controls')).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  }
  await expect(
    page.getByRole('heading', {
      name: 'Écarter les technologies exposées aux lois extraterritoriales',
    }),
  ).toBeVisible();
  await context.close();
});
