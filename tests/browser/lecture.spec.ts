import { expect, test } from '@playwright/test';
import votes from '../../src/data/legislative-votes.json' with { type: 'json' };
import tracks from '../../src/data/proposal-evolution.json' with { type: 'json' };
import housing from '../../src/data/territoires/sru.json' with { type: 'json' };
import { electricityComparison } from '../../src/lib/electricity-tax.mjs';

test('les nouveaux décryptages relient le graphique aux données et aux textes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/dossiers/');
  const dossiers = page.locator('.digest-grid a');
  await expect(dossiers.first()).toHaveAttribute(
    'href',
    '/dossiers/electricite-tva-accise/',
  );
  await dossiers.first().click();
  const electricity = electricityComparison(6, 2200)!;
  const expected = [
    electricity.current,
    ...electricity.alternatives.map((x) => x.amount),
  ];
  const diagram = page.locator('.dossier-chart');
  const format = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 });
  for (const cents of expected) {
    await expect(diagram).toContainText(format.format(cents / 100));
  }
  await expect(
    page.getByRole('link', {
      name: 'Saisir ses kilowattheures dans le simulateur',
    }),
  ).toHaveAttribute('href', '/economie/simulateurs/electricite/');

  await page.goto('/dossiers/logement-social-communes/');
  for (const code of ['69123', '35238'] as const) {
    await expect(diagram).toContainText(housing[code].rate!.replace('%', ' %'));
  }
  await expect(
    page.getByRole('link', { name: 'Notice et CSV du 11 août 2026' }),
  ).toHaveAttribute(
    'href',
    'https://www.data.gouv.fr/datasets/communes-et-inventaire-sru',
  );

  await page.goto('/dossiers/droits-de-succession/');
  await expect(diagram.getByRole('img')).toHaveAccessibleName(
    /50 000 euros restants/,
  );
  await expect(
    page.getByRole('link', { name: 'Exemple et barème de Service Public' }),
  ).toHaveAttribute(
    'href',
    'https://www.service-public.gouv.fr/particuliers/vosdroits/F35794',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test('les premières données sont visibles sur un téléphone sans défiler', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cases = [
    ['/', '.home-choices a[href="/comparer/"]'],
    ['/sondages/', '#poll-bars .poll-bar-row'],
    ['/mesures/', '#measure-results h3'],
    ['/numerique/ce-qui-changerait/', '.law-card h3'],
    ['/votes/', '.subject-card .vote-preview strong'],
    ['/evolution/', '.distribution li'],
    ['/budget-programmes/', '.budget-number'],
    ['/recherche/', '#search-discovery h2'],
    ['/candidats/attal/', '#mesures-du-candidat'],
  ];
  for (const [route, target] of cases) {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(target).first(), route).toBeInViewport({
      ratio: 0.9,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      route,
    ).toBeLessThanOrEqual(390);
  }
});

test('les graphiques de synthèse comptent chaque scrutin et chaque dossier une fois, même sans script', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const [route, expected] of [
    ['/votes/', votes.ballots.length],
    ['/evolution/', tracks.tracks.length],
  ] as const) {
    await page.goto(route);
    const chart = page.locator('figure.distribution');
    const counts = await chart.locator('li b').allTextContents();
    expect(counts.map(Number).reduce((a, b) => a + b, 0)).toBe(expected);
    const widths = await chart
      .locator('svg rect')
      .evaluateAll((rects) =>
        rects.map((rect) => Number(rect.getAttribute('width'))),
      );
    expect(widths).toEqual(counts.map(Number));
  }
  await page.goto('/votes/');
  const link = page.locator('.subject-card').first();
  await expect(link.locator('.vote-preview')).toBeVisible();
  await link.click();
  await expect(
    page.locator('[data-vote-case] .ballot-chart').first(),
  ).toBeVisible();
  await page.goto('/mesures/');
  await page.locator('a[data-filter-theme="retraites"]').click();
  await expect(page).toHaveURL(/\/themes\/retraites\/$/);
  await context.close();
});

test('choisir un thème ramène aux mesures correspondantes', async ({
  page,
}) => {
  await page.goto('/mesures/#candidate=attal');
  await expect(page.locator('[name="candidate"]')).toHaveValue('attal');
  await page.locator('a[data-filter-theme="retraites"]').click();
  await expect(page).toHaveURL(/#theme=retraites$/);
  await expect(page.locator('[name="theme"]')).toHaveValue('retraites');
  await expect(page.locator('[name="candidate"]')).toHaveValue('');
  await expect(page.locator('#resultats')).toBeFocused();
  await expect(page.locator('#measure-results h3').first()).toBeInViewport();
});

test('le dossier retraites met à jour le graphique sans transmettre la génération', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (event) => requests.push(event.url()));
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/dossiers/retraites-ages-et-conditions/');
  await expect(page.locator('.retirement-board')).toContainText('64 ans');
  const before = requests.length;
  await page.getByLabel('Période de naissance').selectOption('1966');
  await expect(page.locator('.retirement-board')).toContainText(
    '63 ans et 3 mois',
  );
  await expect(page.locator('[data-cohort-status]')).toContainText('1966');
  const svg = page.getByRole('link', { name: 'Télécharger le graphique SVG' });
  await expect(svg).toHaveAttribute('href', /^data:image\/svg\+xml;base64,/);
  const waiting = page.waitForEvent('download');
  await svg.click();
  expect((await waiting).suggestedFilename()).toBe(
    'polradar-retraites-1966.svg',
  );
  await expect(page.locator('#comptes meter')).toHaveCount(4);
  await expect(page.locator('.retirement-panel dl > div > dt')).toHaveCount(12);
  expect(requests.slice(before).filter((url) => url.includes('1966'))).toEqual(
    [],
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(321);
});
