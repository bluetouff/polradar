import { test, expect } from '@playwright/test';
import airtime from '../../src/data/airtime.json' with { type: 'json' };
import agenda from '../../src/data/campaign-agenda.json' with { type: 'json' };
import budgets from '../../src/data/programme-budgets.json' with { type: 'json' };
const annualProfiles = budgets.profiles.filter((p) =>
  p.entries.some((e) => e.period === 'annuel'),
);
const annualEntryCount = budgets.profiles.reduce(
  (n, p) => n + p.entries.filter((e) => e.period === 'annuel').length,
  0,
);
const parisEvents = agenda.events.filter(
  (e) => e.city === 'paris' && e.date >= '2026-11-18',
);

test('les relevés Arcom filtrent média et personne sans perdre les durées manquantes', async ({
  page,
}) => {
  const external: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4321/')) external.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/temps-de-parole/');
  await expect(page.locator('.airtime-row:visible')).toHaveCount(
    airtime.months[0].services.filter(
      (service) => service.kind === 'television',
    ).length,
  );
  await page.locator('#airtime-month').selectOption('2026-09');
  await page.locator('#airtime-kind').selectOption('radio');
  await expect(page.locator('.airtime-row:visible')).toHaveCount(
    airtime.months
      .find((month) => month.month === '2026-09')!
      .services.filter((service) => service.kind === 'radio').length,
  );
  await page.locator('#airtime-candidate').selectOption('retailleau');
  await expect(page.locator('#airtime-legend')).toContainText(
    'Bruno Retailleau',
  );
  await page.locator('#airtime-kind').selectOption('television');
  const bfm = page.locator(
    '.airtime-month:visible .airtime-row[data-service="BFMTV"]',
  );
  await expect(bfm.locator('.airtime-focus')).toHaveText(
    'Bruno Retailleau : 4 h 56 min 38 s',
  );
  await page.locator('#airtime-candidate').selectOption('branco');
  await expect(bfm.locator('.airtime-focus')).toHaveText(
    'Juan Branco : Non publié',
  );
  await expect(bfm.locator('[data-segment="0"]')).toHaveAttribute('width', '0');
  await page.locator('#airtime-month').selectOption('2026-07');
  await expect(page.locator('.airtime-month:visible')).toHaveAttribute(
    'data-airtime-month',
    '2026-07',
  );
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await expect(page.locator('#airtime-month')).toHaveValue(
    airtime.months[0].month,
  );
  await expect(page.locator('#airtime-candidate')).toHaveValue('');
  await page.locator('#airtime-kind').selectOption('');
  await page.reload();
  await expect(page.locator('.airtime-row:visible')).toHaveCount(
    airtime.months[0].services.length,
  );
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test('les montants annuels et les objectifs à terme se filtrent et se réinitialisent', async ({
  page,
}) => {
  await page.goto('/budget-programmes/');
  await expect(page.locator('.budget-profile:visible')).toHaveCount(
    budgets.profiles.length,
  );
  await page.locator('#budget-period').selectOption('annuel');
  await expect(page.locator('.budget-profile:visible')).toHaveCount(
    annualProfiles.length,
  );
  await expect(page.locator('.budget-entry:visible')).toHaveCount(
    annualEntryCount,
  );
  await page.locator('#budget-candidate').selectOption('philippe');
  await expect(page.locator('#budget-empty')).toBeVisible();
  await page.locator('#budget-period').selectOption('horizon');
  await expect(page.locator('.budget-profile:visible')).toHaveCount(1);
  await expect(page.locator('.budget-number:visible')).toContainText(
    '≈ 150 Md€',
  );
  await page.reload();
  await expect(page.locator('#budget-candidate')).toHaveValue('philippe');
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await expect(page.locator('.budget-profile:visible')).toHaveCount(
    budgets.profiles.length,
  );
  await page.locator('#budget-candidate').selectOption('polony');
  await expect(page.locator('#budget-empty')).toBeVisible();
  await page.locator('#budget-candidate').selectOption('branco');
  await page.locator('#budget-period').selectOption('non-precise');
  await expect(page.locator('.budget-number:visible')).toContainText(
    '3 à 4 Md€',
  );
  await page.locator('#budget-candidate').selectOption('ruffin');
  await page.locator('#budget-period').selectOption('pluriannuel');
  await expect(page.locator('.budget-number:visible')).toContainText(
    '8 à 12 Md€',
  );
  await page.locator('#budget-candidate').selectOption('melenchon');
  await page.locator('#budget-period').selectOption('annuel');
  await expect(page.locator('#melenchon-investissement-textile')).toContainText(
    '240 M€',
  );
});
test('la carte et les fiches partagent les filtres et le jour civil de Paris', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-17T23:05:00Z'));
  await page.goto('/agenda/');
  await expect(page.locator('.agenda-event:visible')).toHaveCount(
    agenda.events.filter((e) => e.date >= '2026-11-18').length,
  );
  await page.locator('#agenda-city').selectOption('paris');
  await expect(page.locator('.agenda-event:visible')).toHaveCount(
    parisEvents.length,
  );
  await expect(page.locator('.map-count:visible')).toHaveCount(1);
  await expect(page.locator('.map-count:visible')).toHaveText(
    String(parisEvents.length),
  );
  await page.locator('#agenda-candidate').selectOption('arthaud');
  await expect(page.locator('.agenda-event:visible')).toHaveCount(1);
  await expect(page.locator('.agenda-event:visible')).toHaveAttribute(
    'data-date',
    '2027-01-24',
  );
  // The Lyon-labelled meeting is actually in Vénissieux; these communes stay distinct.
  await page.locator('#agenda-city').selectOption('lyon');
  await expect(page.locator('#agenda-empty')).toBeVisible();
  await expect(page.locator('.map-count:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await page.locator('#agenda-period').selectOption('passes');
  await expect(page.locator('.agenda-event:visible')).toHaveCount(
    agenda.events.filter((e) => e.date < '2026-11-18').length,
  );
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await page.locator('[data-map-cities~="paris"]').click();
  await page
    .locator('#map-city-choices')
    .getByRole('button', { name: 'Paris', exact: true })
    .click();
  await expect(page.locator('#agenda-city')).toHaveValue('paris');
  await page.reload();
  await expect(page.locator('.agenda-event:visible')).toHaveCount(
    parisEvents.length,
  );
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  const southern = page
    .locator('[data-map-cities]')
    .filter({ has: page.locator('title', { hasText: 'Arles' }) });
  await southern.click();
  await expect(page.locator('#map-city-choices')).toBeVisible();
  await page
    .locator('#map-city-choices')
    .getByRole('button', { name: 'Arles', exact: true })
    .click();
  await expect(page.locator('.agenda-event:visible')).toHaveCount(2);
});
test('les profils ajoutés se consultent et un lieu inconnu ne crée pas de repère', async ({
  page,
}) => {
  await page.goto('/budget-programmes/');
  for (const profile of budgets.profiles) {
    await page.locator('#budget-candidate').selectOption(profile.candidate);
    await expect(page.locator('.budget-profile:visible')).toHaveCount(1);
    await expect(page.locator('.budget-entry:visible')).toHaveCount(
      profile.entries.length,
    );
  }
  await page.clock.setFixedTime(new Date('2026-11-18T09:00:00Z'));
  await page.goto('/agenda/');
  await page.locator('#agenda-candidate').selectOption('philippe');
  await expect(page.locator('.agenda-event:visible')).toHaveCount(1);
  await expect(page.locator('.agenda-event:visible')).toContainText(
    'Horaire non précisé',
  );
  await expect(page.locator('.agenda-event:visible')).toContainText(
    'Lieu non précisé',
  );
  await expect(page.locator('.map-count:visible')).toHaveCount(0);
  await page.locator('#agenda-candidate').selectOption('lisnard');
  await expect(page.locator('.agenda-event:visible .agenda-place')).toHaveText(
    'Chassieu',
  );
  await page.locator('#agenda-candidate').selectOption('mikolajczak');
  await page.locator('#agenda-city').selectOption('ivry-sur-seine');
  await expect(page.locator('.agenda-event:visible')).toHaveCount(1);
  await expect(page.locator('.map-count:visible')).toHaveText('1');
});
for (const route of ['/temps-de-parole/', '/budget-programmes/', '/agenda/']) {
  test(`${route} reste lisible sans JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4321${route}`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.visual-filters')).toBeHidden();
    if (route === '/agenda/')
      await expect(page.locator('.agenda-event:visible')).toHaveCount(
        agenda.events.length,
      );
    if (route === '/temps-de-parole/')
      await expect(page.locator('.airtime-row:visible')).toHaveCount(
        airtime.months[0].services.length,
      );
    if (route === '/budget-programmes/')
      await expect(page.locator('.budget-entry:visible')).toHaveCount(
        budgets.profiles.reduce((n, p) => n + p.entries.length, 0),
      );
    await context.close();
  });
  test(`${route} ne déborde pas à 320, 390, 768 et 1440 pixels`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      if (width === 390) {
        await expect(page.locator('.visual-filters')).toBeHidden();
        await page.locator('.visual-controls > summary').click();
        await expect(page.locator('.visual-filters')).toBeVisible();
      }
      for (const svg of await page.locator('main svg[viewBox]').all()) {
        const rect = await svg.boundingBox();
        if (rect) expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
      }
    }
    expect(errors).toEqual([]);
  });
}
