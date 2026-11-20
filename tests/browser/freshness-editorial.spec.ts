import { expect, test } from '@playwright/test';
import review from '../../src/data/digital-reviews.json' with { type: 'json' };
import history from '../../src/data/daily-updates.json' with { type: 'json' };

test('chaque candidat dispose de documents numériques et les textes collectifs gardent leur auteur', async ({
  page,
}) => {
  await page.goto('/numerique/candidats/#glucksmann');
  const cards = page.locator('.review-card');
  await expect(cards).toHaveCount(Object.keys(review.documents).length);
  const candidate = page.locator('#glucksmann');
  await expect(candidate).toBeVisible();
  await candidate.locator('details').first().locator('summary').click();
  await expect(
    candidate
      .getByText('Projet de parti · Place publique', { exact: true })
      .first(),
  ).toBeVisible();
  await candidate.locator('.review-docs summary').click();
  await expect(
    candidate.getByRole('link', { name: /42 chantiers/ }),
  ).toBeVisible();
  await page.goto(
    '/numerique/ce-qui-changerait/donnees-personnelles/decisions-automatisees/',
  );
  await expect(
    page.locator('.law-byline').getByText('Parti socialiste', { exact: true }),
  ).toBeVisible();
  await page.goto('/numerique/ce-qui-changerait/enseignement/');
  await expect(
    page
      .getByRole('link', { name: 'Code de l’éducation, art. L. 312-9' })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .locator('.law-byline')
      .getByText('Jean-François Legendre', { exact: true }),
  ).toBeVisible();
});
test('le journal publie ses six contrôles et la date réelle de la dernière exécution', async ({
  page,
}) => {
  await page.goto('/mises-a-jour/');
  await expect(page.locator('.fresh-card')).toHaveCount(6);
  await expect(page.locator('#last-report')).toHaveAttribute(
    'datetime',
    history[0].at,
  );
  for (const id of [
    'arcom',
    'economie',
    'veille',
    'polymarket',
    'kalshi',
    'sondages',
  ])
    await expect(page.locator('#journal-' + id)).toBeVisible();
  await expect(
    page
      .locator('.daily-run')
      .first()
      .getByRole('link', { name: 'Exécution GitHub ↗' }),
  ).toHaveAttribute('href', new RegExp('/' + history[0].run + '/attempts/'));
});
test('lisibilité des encadrés et pictogrammes de partage', async ({ page }) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/methode/');
    const margins = await page
      .locator('.method-grid>.panel')
      .evaluateAll((nodes) =>
        nodes.map(
          (n) =>
            n.querySelector('.eyebrow')!.getBoundingClientRect().left -
            n.getBoundingClientRect().left,
        ),
      );
    expect(Math.min(...margins)).toBeGreaterThanOrEqual(15);
    await page.goto('/transparence/');
    const note = page.locator('.repository-note');
    expect(
      await note.locator('h2').evaluate((n) => getComputedStyle(n).color),
    ).toBe('rgb(245, 251, 254)');
    expect(
      await note.evaluate((n) => parseFloat(getComputedStyle(n).paddingLeft)),
    ).toBeGreaterThanOrEqual(16);
    const logos = await page
      .locator('.page-share a')
      .evaluateAll((nodes) =>
        nodes.map((n) => getComputedStyle(n, '::before').maskImage),
      );
    expect(logos).toHaveLength(5);
    expect(new Set(logos).size).toBe(5);
    expect(logos.every((x) => x !== 'none')).toBe(true);
  }
});
test('les encadrés de méthode gardent un retrait sur les quatre côtés', async ({
  page,
}) => {
  const panels = [
    ['/financements/', '#financing-method'],
    ['/evolution/', '#evolution-method'],
    ['/agenda/', '.visual-method'],
    ['/budget-programmes/', '.visual-method'],
    ['/temps-de-parole/', '.visual-method'],
    ['/sondages/', '.poll-method'],
    ['/marches-predictifs/', '.poll-method'],
    ['/economie/finances-publiques/', '.panel.dark-panel'],
  ];
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, selector] of panels) {
      await page.goto(path);
      const panel = page.locator(selector);
      if (selector === '.visual-method') await panel.locator('summary').click();
      const clearance = await panel.evaluate((node) => {
        const frame = node.getBoundingClientRect();
        const children = [...node.children].map((c) =>
          c.getBoundingClientRect(),
        );
        return Math.min(
          ...children.flatMap((r) => [
            r.left - frame.left,
            frame.right - r.right,
            r.top - frame.top,
            frame.bottom - r.bottom,
          ]),
        );
      });
      expect(clearance, path + ' à ' + width + ' px').toBeGreaterThanOrEqual(
        15.9,
      );
    }
  }
});
test('la page d’accueil et le budget nomment les candidats dans le filtre et le compteur', async ({
  page,
}) => {
  for (const path of [
    '/',
    '/budget-programmes/',
    '/divergences/',
    '/agenda/',
    '/numerique/',
  ]) {
    await page.goto(path);
    await expect(page.locator('main')).not.toContainText(/\bprofils?\b/i);
  }
  await page.goto('/budget-programmes/');
  await expect(page.locator('#budget-candidate option').first()).toHaveText(
    'Tous les candidats',
  );
  await page.locator('#budget-candidate').selectOption('lisnard');
  await expect(page.locator('#budget-status')).toContainText('1 candidat');
});
