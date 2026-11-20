import { test, expect } from '@playwright/test';
import wave from '../../src/data/ches-france-2024.json' with { type: 'json' };
import votes from '../../src/data/legislative-votes.json' with { type: 'json' };
import agenda from '../../src/data/campaign-agenda.json' with { type: 'json' };
test('les deux plans et le tableau restituent la même enquête', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/echiquier/');
  await expect(page.locator('.plot-societe .map-point:visible')).toHaveCount(
    wave.parties.length,
  );
  await page.getByRole('radio', { name: 'Intégration européenne' }).check();
  await expect(page.locator('.plot-europe')).toBeVisible();
  await expect(page.locator('.plot-societe')).toBeHidden();
  await page.locator('.plot-europe [data-party="602"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#parti-602')).toHaveClass(/selected/);
  await expect(page.locator('#parti-602 td')).toHaveText(['3,4', '2,7', '6,3']);
  for (const w of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width: w, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
});
test('la comparaison sépare parti, candidat et position absente et se partage', async ({
  page,
}) => {
  await page.goto('/echiquier/');
  await page
    .locator('#issue-choice')
    .selectOption('europe-participation-union');
  await page.locator('#profile-choice').selectOption('glucksmann');
  await expect(page.locator('.issue-lane a:visible')).toHaveText(
    /◇\s*Place publique\s*Texte du parti/,
  );
  await expect(page.locator('[data-issue-missing]:visible')).toContainText(
    'Seul le texte du parti',
  );
  await page.reload();
  await expect(page.locator('#profile-choice')).toHaveValue('glucksmann');
  await page.locator('#profile-choice').selectOption('philippot');
  await expect(page.locator('.issue-lane a:visible')).toContainText(
    'Florian Philippot',
  );
  await page.locator('#profile-choice').selectOption('durif');
  await expect(page.locator('[data-issue-missing]:visible')).toContainText(
    'Aucune position documentée',
  );
  await expect(page.locator('.issue-lane a:visible')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('#profile-choice')).toHaveValue('philippot');
});
test('la carte, les textes et les candidats se consultent sans JavaScript', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4321/echiquier/');
  await page.getByRole('radio', { name: 'Intégration européenne' }).check();
  await expect(page.locator('.plot-europe')).toBeVisible();
  await page.locator('#question-europe-participation-union summary').click();
  await expect(
    page.locator('#question-europe-participation-union'),
  ).toContainText('Christian Collovati');
  await page.locator('.sheet-atlas summary').click();
  await expect(page.locator('.sheet-grid')).toContainText('Sylvain Durif');
  await ctx.close();
});

test('les six dossiers donnent accès aux sources et aux rendez-vous selon la couverture réelle', async ({
  page,
}) => {
  await page.goto('/candidats/philippot/');
  await expect(page.locator('#scrutins')).toContainText('Abstention');
  await page
    .locator('#scrutins .activity-title')
    .filter({ hasText: 'Canada' })
    .click();
  await expect(page.locator('[data-ballot="pe8-20170215-ceta"]')).toContainText(
    'Contre le texte',
  );
  await page.goto('/candidats/lassalle/');
  await page.locator('#scrutins details summary').click();
  await expect(page.locator('#scrutins .activity-title:visible')).toHaveCount(
    votes.ballots.filter((b) =>
      b.positions.some((p) => p.candidate === 'lassalle'),
    ).length,
  );
  if (!agenda.events.some((e) => e.candidate === 'lassalle'))
    await expect(page.locator('#rendez-vous')).toContainText('Publication du');
  await page.goto(
    '/echiquier/?question=travail-demarches-entreprises&candidature=riner#issues-title',
  );
  await expect(page.locator('.issue-lane a:visible')).toContainText(
    'Teddy Riner',
  );
  await page.locator('[data-issue-shortcuts] a').first().click();
  await expect(page.locator('#rendez-vous')).toContainText(
    'hôpital Delafontaine',
  );
  await page.goto('/agenda/#rohou-associations-paris');
  await expect(page.locator('#rohou-associations-paris')).toBeVisible();
  await expect(page.locator('#rohou-associations-paris')).toContainText(
    '16 h 30',
  );
  for (const id of ['cheve', 'billetdoux']) {
    await page.goto(`/candidats/${id}/`);
    const ballots = votes.ballots.filter((b) =>
      b.positions.some((p) => p.candidate === id),
    );
    const dates = agenda.events.filter((e) => e.candidate === id);
    await expect(page.locator('#scrutins .activity-title')).toHaveCount(
      ballots.length,
    );
    await expect(page.locator('#rendez-vous .activity-title')).toHaveCount(
      dates.length,
    );
    if (!ballots.length)
      await expect(page.locator('#scrutins')).toContainText(
        'Aucun vote nominatif recensé',
      );
    if (!dates.length) {
      const check = agenda.sourceChecks.find((entry) => entry.candidate === id);
      await expect(page.locator('#rendez-vous')).toContainText(
        check?.note ?? 'Aucun rendez-vous daté',
      );
      if (check)
        await expect(
          page
            .locator('#rendez-vous')
            .getByRole('link', { name: /Source consultée/ }),
        ).toBeVisible();
    }
    await page.getByRole('link', { name: 'Voir dans l’échiquier' }).click();
    await expect(page.locator('#profile-choice')).toHaveValue(id);
    await expect(page.locator('.issue-lane a:visible')).toHaveCount(1);
  }
});
