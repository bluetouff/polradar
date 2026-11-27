import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('une proposition sur le prix de l’électricité reste un complément sur le nucléaire', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/questions/climat-production-nucleaire/');
  const target = '/mesures/lepen-renegocier-prix-electricite-europe/#version-3';
  const complement = page
    .locator('#candidat-lepen section[data-relation=complement]')
    .filter({
      has: page.locator('h3 a[href="' + target + '"]'),
    });
  await expect(
    complement.getByText('Complément', { exact: true }),
  ).toBeVisible();
  await expect(complement.locator('.q-complement')).toContainText(
    /tarif|prix/i,
  );
  await expect(
    page.locator(
      '#candidat-lepen section[data-relation=reponse] a[href="' + target + '"]',
    ),
  ).toHaveCount(0);

  const sources = complement.locator('details.q-citations');
  await sources.locator('summary').press('Enter');
  await expect(sources).toHaveAttribute('open', '');
  await expect(
    sources.getByRole('link', { name: /Une énergie moins chère/ }),
  ).toHaveAttribute(
    'href',
    'https://www.marinelepen.com/materiel-de-campagne/3/telecharger#page=2',
  );
  await expect(sources).toContainText(
    'Fixation du prix de l’électricité · p. 2 du PDF',
  );

  const answers = page.locator('#reponses article').filter({
    has: page.locator('section[data-relation=reponse]'),
  });
  await expect(page.locator('#couverture')).toContainText(
    (await answers.count()) + ' dossier',
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(320);
  await expect(
    page.getByRole('link', { name: /Comparer les candidats/ }),
  ).toHaveAttribute('href', '/comparer/?question=climat-production-nucleaire');
});

test('une version à relire garde le passage cité et donne accès à la version courante', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/questions/salaires-enseignants/');
  const base = '/mesures/branco-salaires-enseignants-debut-carriere/';
  const section = page.locator('#candidat-branco section').filter({
    has: page.locator('h3 a[href="' + base + '#version-1"]'),
  });
  await expect(
    section.getByText('Version à relire', { exact: true }),
  ).toBeVisible();
  await expect(section.locator('.q-stale')).toContainText(
    'Passage cité dans la version 1',
  );
  const citations = section.locator('details.q-citations');
  await citations.locator('summary').press('Space');
  await expect(
    citations.getByRole('link', { name: /La Voie, programme intégral/ }),
  ).toHaveAttribute(
    'href',
    'https://ruches.org/projet-1784217879253.pdf#page=37',
  );
  await expect(citations).toContainText('page 37');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  const current = section.getByRole('link', { name: /Lire la version 2/ });
  await expect(current).toHaveAttribute('href', base + '#version-2');
  await current.press('Enter');
  await expect(page).toHaveURL(new RegExp(base + '#version-2$'));
  await expect(page.locator('#version-2')).toBeVisible();
});

test('le document complémentaire numérique et le droit en vigueur restent accessibles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/questions/numerique-signalement-cyber/');
  const complement = page.locator('section[data-relation=complement]').filter({
    hasText: 'Réunir les plateformes de signalement des délits en ligne',
  });
  await expect(complement).toHaveCount(1);
  await expect(complement).toContainText('Renaissance');
  await complement.locator('summary').press('Enter');
  await expect(complement).toContainText('proposition 25, p. 24 du PDF');
  await expect(
    page.getByRole('link', { name: /Droit en vigueur et propositions/ }),
  ).toHaveAttribute(
    'href',
    '/numerique/ce-qui-changerait/cybersecurite/signalement/',
  );
  await expect(page.locator('#couverture')).toContainText(
    'uniquement des compléments',
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(320);
});

test('le renvoi depuis le haut du dossier CSG atteint directement les réponses', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/questions/fiscalite-csg-salaires/');
  await page.getByRole('link', { name: /Aller aux réponses/ }).press('Enter');
  await expect(page).toHaveURL(
    /\/questions\/fiscalite-csg-salaires\/#reponses$/,
  );
  await expect(page.locator('#reponses')).toBeFocused();
  await expect(page.locator('#candidat-attal')).toBeVisible();
});
