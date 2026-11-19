import { test, expect } from '@playwright/test';

test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 840 } });

test('les huit situations sont navigables sur mobile et relient les textes et versions exactes', async ({
  page,
}) => {
  await page.goto('/numerique/');
  const entry = page.getByRole('navigation', {
    name: 'Droit en vigueur et propositions',
  });
  await entry.getByRole('link', { name: 'Chiffrement' }).click();
  await expect(page).toHaveURL(/\/numerique\/ce-qui-changerait\/$/);
  await expect(
    page.getByRole('heading', { name: 'Droit en vigueur' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'LCEN, art. 30 I' }),
  ).toBeVisible();
  await expect(page.locator('.law-change .law-byline span').first()).toHaveText(
    'Les Écologistes',
  );
  await expect(
    page.getByRole('link', { name: 'Fiche datée' }).first(),
  ).toHaveAttribute(
    'href',
    '/mesures/tondelier-institutions-outils-chiffres/#version-1',
  );

  await page
    .getByRole('navigation', { name: 'Accès aux deux volets' })
    .getByRole('link', { name: 'Changements proposés' })
    .click();
  await expect(page).toHaveURL(/#law-next$/);
  await expect(
    page.getByRole('heading', { name: 'Changements proposés' }),
  ).toBeInViewport();

  await page.getByRole('link', { name: 'Réquisitions', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Parcours parlementaire' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Changements proposés' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Voir le graphique du scrutin' }),
  ).toHaveAttribute(
    'href',
    '/numerique/comparer/chiffrement/#encryption-vote-title',
  );
  await page
    .getByRole('navigation', { name: 'Thèmes du comparatif juridique' })
    .getByRole('link', { name: 'Données personnelles' })
    .click();
  await expect(page.getByRole('link', { name: 'RGPD, art. 20' })).toBeVisible();

  const tabs = page.getByRole('navigation', {
    name: 'Situations · Données personnelles',
  });
  for (const [name, reference] of [
    ['Portabilité', 'DMA, art. 6 § 9'],
    ['Publicité ciblée', 'DSA, art. 19 et 26 § 3'],
    ['Courtiers en données', 'RGPD, art. 6 et 14'],
    ['Décisions automatisées', 'Loi Informatique et Libertés, art. 47'],
    ['Identité numérique', 'eIDAS, art. 5 bis § 1 et 15'],
    ['Cloud de l’État', 'Décret n° 2026-272'],
  ]) {
    await tabs.getByRole('link', { name, exact: true }).click();
    await expect(tabs.getByRole('link', { name, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(
      page.getByRole('link', { name: reference, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href');
    expect(canonical).toBe(
      'https://polradar.fr' + new URL(page.url()).pathname,
    );
  }
});
