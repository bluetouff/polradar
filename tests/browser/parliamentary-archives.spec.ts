import { test, expect } from '@playwright/test';
import { testOrigin } from './origin';

test('les deux chambres se parcourent sans JavaScript à 360 px', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 360, height: 780 },
  });
  const page = await ctx.newPage();
  try {
    await page.goto(testOrigin + '/votes/archives/');
    await page.getByRole('link', { name: 'Session 2022–2023' }).click();
    await expect(page.locator('.parl-card')).toHaveCount(30);
    await page.getByRole('link', { name: 'Page suivante' }).click();
    await expect(page).toHaveURL(/senat-2022\/2\/?#resultats/u);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.getByRole('link', { name: 'Toutes les périodes' }).click();
    await page.getByRole('link', { name: '12 mars 2024' }).click();
    await expect(
      page.getByText('Aucune position ni mise au point', { exact: false }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Toutes les périodes' }).click();
    await page.getByRole('link', { name: '21 octobre 2026' }).click();
    await expect(
      page
        .locator('.parl-card')
        .first()
        .getByRole('link', { name: 'Point du procès-verbal' }),
    ).toHaveAttribute(
      'href',
      'https://data.europarl.europa.eu/eli/dl/doc/PV-10-2026-10-21-RCV-ITM-136',
    );
  } finally {
    await ctx.close();
  }
});

test('le dossier sur le règlement IA rejoint le point individuel du procès-verbal', async ({
  page,
}) => {
  await page.goto(testOrigin + '/votes/dossiers/glucksmann-ia-transparence/');
  await page.getByText('Objet du scrutin et sources officielles').click();
  await page
    .getByRole('link', { name: 'Relevé nominatif et point du procès-verbal' })
    .click();
  await expect(page).toHaveURL(/#MTG-PL-2024-03-13-DEC-166051$/u);
  const ballot = page.locator('#MTG-PL-2024-03-13-DEC-166051');
  await expect(ballot.getByRole('heading')).toContainText('Am 808');
  await expect(
    ballot.getByRole('link', { name: 'Point du procès-verbal' }),
  ).toHaveAttribute(
    'href',
    'https://data.europarl.europa.eu/eli/dl/doc/PV-9-2024-03-13-RCV-ITM-003',
  );
  await ballot
    .getByRole('link', {
      name: 'Transparence des contenus produits par IA sur Polradar',
    })
    .click();
  await expect(page).toHaveURL(
    /\/votes\/dossiers\/glucksmann-ia-transparence\/$/u,
  );
});

test('le vote de 2017 sur le CETA rassemble trois élus et garde un seul scrutin collectif', async ({
  page,
}) => {
  await page.goto(testOrigin + '/votes/archives/');
  await page
    .getByRole('link', { name: '15 février 2017 · votes individuels' })
    .click();
  const section = page.getByRole('region', {
    name: 'Votes individuels sur le CETA',
  });
  await expect(section.getByRole('listitem')).toHaveCount(3);
  for (const name of [
    'Marine Le Pen',
    'Jean-Luc Mélenchon',
    'Florian Philippot',
  ]) {
    await expect(
      section
        .getByRole('listitem')
        .filter({ has: page.getByRole('link', { name, exact: true }) }),
    ).toContainText('contre');
  }
  const response = await page.request.get(testOrigin + '/api/dossiers.json');
  const report = await response.json();
  const recorded = report.votes.filter(
    (v: { ballotId: string }) => v.ballotId === 'pe8-20170215-ceta',
  );
  expect(
    new Set(recorded.map((v: { candidate: string }) => v.candidate)),
  ).toEqual(new Set(['lepen', 'melenchon', 'philippot']));
  for (const row of recorded) {
    expect(row.tally.for).toBe(408);
    expect(row.archiveNominale.mandat).toContain(row.position.officialId);
    if (row.candidate !== 'philippot') expect(row.relation).toBe(null);
  }
});
