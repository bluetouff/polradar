import { test, expect } from '@playwright/test';
import corpus from '../../src/data/measures.json' with { type: 'json' };
import people from '../../src/data/candidates.json' with { type: 'json' };
import themes from '../../src/data/themes.json' with { type: 'json' };

const count = (scope: string) => corpus.filter((m) => m.scope === scope).length;
test('les graphiques du corpus et les liens des dossiers correspondent aux fiches publiées', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/statistiques/');
  const n = count('campagne') + count('parti');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Le corpus en chiffres' }),
  ).toBeVisible();
  await expect(page.locator('[data-proposal-total]')).toHaveAttribute(
    'data-proposal-total',
    String(n),
  );
  const chart = page.locator('[data-theme-chart]');
  for (const scope of ['parti', 'archive', 'current']) {
    await chart.getByRole('combobox').selectOption(scope);
    const expected =
      scope === 'current'
        ? corpus.filter((m) => m.scope !== 'archive')
        : corpus.filter((m) => m.scope === scope);
    await expect(chart.locator('.chart-sum span')).toHaveText(
      expected.length.toLocaleString('fr-FR'),
    );
    const bars = chart.locator('li');
    await expect(bars).toHaveCount(themes.length);
    const link = chart.getByRole('link', { name: 'Retraites', exact: true });
    await expect(link.locator('..').locator('strong')).toHaveText(
      String(expected.filter((m) => m.theme === 'retraites').length),
    );
  }
  await chart.getByRole('combobox').selectOption('archive');
  const archive = chart.getByRole('link', { name: 'Retraites', exact: true });
  await expect(archive).toHaveAttribute(
    'href',
    '/mesures/#theme=retraites&scope=archive',
  );
  const summary = page
    .locator('summary')
    .filter({ hasText: 'dossiers et leurs chiffres' });
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.candidate-counts article')).toHaveCount(
    people.length,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole('link', { name: 'Jean-François Legendre', exact: true }),
  ).toHaveAttribute('href', '/candidats/legendre/');
  await archive.click();
  await expect(page.getByLabel('Type de fiche')).toHaveValue('archive');
  const archiveTotal = corpus.filter(
    (m) => m.scope === 'archive' && m.theme === 'retraites',
  ).length;
  await expect(page.locator('#measure-count')).toContainText(
    String(archiveTotal) + ' résultat',
  );
  await page.goto(
    '/mesures/villepin-fixer-la-trajectoire-du-deficit-pour-cinq-ans/',
  );
  await expect(page.locator('.precise-sources a').first()).toHaveAttribute(
    'href',
    /chapitre-1\.html#proposition-1$/,
  );
});
test('les statistiques essentielles sont lisibles sans JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    viewport: { width: 320, height: 700 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/statistiques/');
    const index = await page.request.get('/api/parlement/recherche.json');
    expect(index.ok()).toBe(true);
    const { actes } = await index.json();
    const parliament = page.getByRole('link', { name: /Actes parlementaires/ });
    await expect(parliament).toHaveAttribute('href', '/votes/recherche/');
    await expect(parliament.locator('strong')).toHaveText(
      actes.length.toLocaleString('fr-FR'),
    );
    await expect(page.locator('.corpus-composition li')).toHaveCount(4);
    await expect(page.locator('.theme-histogram li')).toHaveCount(
      themes.length,
    );
    await expect(page.locator('[name="perimetre"]')).toBeHidden();
    await expect(page.locator('.chart-sum span')).toHaveText(
      (corpus.length - count('archive')).toLocaleString('fr-FR'),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test('le relevé de qualité recompte les notices et scrutins de la même révision', async ({
  page,
  request,
}) => {
  const [quality, publications, register, build, exports] = await Promise.all(
    [
      '/api/qualite-documentaire.json',
      '/api/notices-sondages.json',
      '/api/parlement/recherche.json',
      '/build.json',
      '/api/exports-v1.json',
    ].map(async (route) => {
      const response = await request.get(route);
      expect(response.ok(), route).toBeTruthy();
      return response.json();
    }),
  );
  expect(quality.sourceCommit).toBe(build.sourceCommit);
  expect(quality.polls.catalogue.total).toBe(publications.notices.length);
  const verified = publications.notices.filter(
    (notice: { status: string }) => notice.status === 'integree',
  ).length;
  expect(quality.polls.catalogue.byStatus.integree).toBe(verified);
  expect(quality.parliament.acts).toBe(register.actes.length);
  for (const institution of quality.parliament.byInstitution) {
    const ballots = register.actes.filter(
      (act: { institution: string; nature: string }) =>
        act.institution === institution.id && act.nature === 'vote',
    );
    const named = ballots.filter(
      (act: { mentions: [string, string, string][] }) =>
        act.mentions.some(([, , kind]) => kind === 'vote'),
    );
    expect(institution.ballots).toBe(ballots.length);
    expect(institution.ballotsWithTrackedVote).toBe(named.length);
  }
  expect(quality.collections).toHaveLength(6);
  for (const entry of quality.collections) {
    expect(entry.attempted).toBeTruthy();
    if (entry.succeeded)
      expect(Date.parse(entry.succeeded)).toBeLessThanOrEqual(
        Date.parse(entry.attempted),
      );
  }
  expect(exports.jeux.map((entry: { id: string }) => entry.id)).toEqual(
    expect.arrayContaining(['qualite-documentaire', 'recherche-parlementaire']),
  );
  await page.goto('/statistiques/#qualite');
  await expect(
    page
      .locator('#qualite')
      .getByRole('link', { name: /notices entièrement vérifiées/ }),
  ).toContainText(verified.toLocaleString('fr-FR'));
});
