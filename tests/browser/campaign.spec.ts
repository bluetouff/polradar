import { testOrigin } from './origin';
import candidateRows from '../../src/data/candidates.json' with { type: 'json' };
import { pageSize } from '../../src/lib/pagination';
import { test, expect } from '@playwright/test';
import campaignEvents from '../../src/data/events.json' with { type: 'json' };
const pastCount = campaignEvents.filter((e) => e.kind === 'past').length;
import observations from '../../src/data/watch.json' with { type: 'json' };
import daily from '../../src/data/daily-updates.json' with { type: 'json' };
import references from '../../src/data/sources.json' with { type: 'json' };
import {
  dailyHistorySchema,
  sourceFreshness,
} from '../../src/lib/daily-updates.mjs';
import { watchSchema } from '../../src/lib/schema.mjs';
const sourcesById = new Map(references.map((s) => [s.id, s]));
const watch = [
  ...sourceFreshness([
    ...watchSchema.array().parse(observations),
    ...dailyHistorySchema.parse(daily).flatMap((run) => run.sourceChecks ?? []),
  ]).values(),
].filter((row) => sourcesById.has(row.sourceId));
const pdfSources = new Set(
  observations
    .filter((row) => row.contentType.includes('pdf'))
    .map((row) => row.sourceId),
);
for (const source of references) {
  if (/\.pdf$/i.test(new URL(source.url).pathname)) pdfSources.add(source.id);
}

const active = candidateRows.filter((c) => !c.withdrawnOn);

test('les dates du scrutin correspondent aux deux tours sur les trois pages', async ({
  page,
}) => {
  const rounds = ['premier-tour', 'second-tour'].map((id) =>
    campaignEvents.find((event) => event.id === id)!,
  );
  for (const [route, selector] of [
    ['/reperes/', '.ballot-month'],
    ['/campagne/', '.campaign-election'],
    ['/', '.cover-calendar dl > div'],
  ]) {
    await page.goto(route);
    const cards = page.locator(selector);
    await expect(cards).toHaveCount(2);
    for (const [index, round] of rounds.entries()) {
      await expect(cards.nth(index)).toContainText(round.title);
      await expect(cards.nth(index).locator('time')).toHaveAttribute(
        'datetime',
        round.date,
      );
    }
  }
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/reperes/');
  for (const [index, round] of rounds.entries())
    await expect(page.locator('.ballot-mark').nth(index)).toHaveText(
      String(Number(round.date.slice(-2))),
    );
  const overseas = page.locator('.ballot-overseas summary');
  await overseas.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/En Guadeloupe, en Martinique/)).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test('la chronologie combine les filtres, gère une recherche vide et se réinitialise', async ({
  page,
}) => {
  await page.goto('/campagne/');
  await expect(page.locator('#campaign-status')).toContainText(
    `${pastCount} événements`,
  );
  await page.locator('#campaign-category').selectOption('programme');
  await page.locator('#campaign-candidate').selectOption('ruffin');
  await expect(page.locator('.campaign-entry:visible')).toHaveCount(4);
  await expect(page.locator('.campaign-month:visible')).toHaveCount(2);
  await page.locator('#campaign-search').fill('école');
  await expect(page.locator('.campaign-entry:visible')).toHaveCount(1);
  await expect(page.locator('.campaign-entry:visible')).toContainText('28');
  await page.locator('#campaign-search').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#campaign-empty')).toBeVisible();
  expect(await page.locator('img[src=x]').count()).toBe(0);
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await expect(page.locator('.campaign-entry:visible')).toHaveCount(pageSize);
  await expect(page.locator('#campaign-empty')).toBeHidden();
});

test('la chronologie et les sources restent accessibles sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${testOrigin}/campagne/`);
  await expect(page.locator('.campaign-entry')).toHaveCount(pastCount);
  await expect(page.locator('#campaign-filters')).toBeHidden();
  await expect(page.locator('#lepen-retraites-2026-11-17')).toContainText(
    'pilier de capitalisation',
  );
  await expect(page.locator('#branco-declaration')).toContainText(
    'Juan Branco',
  );
  await expect(
    page.locator('#ruffin-jeunesse-publication .source-links a'),
  ).toHaveAttribute(
    'href',
    'https://nouspresident.fr/redonner-aux-jeunes-les-clefs-de-leur-avenir/',
  );
  await context.close();
});

test('la veille filtre les formats et les états en gardant sa matrice cohérente', async ({
  page,
}) => {
  await page.goto('/veille/');
  await expect(page.locator('.watch-card:visible')).toHaveCount(
    Math.min(pageSize, watch.length),
  );
  await expect(page.locator('.watch-cell:visible')).toHaveCount(watch.length);
  await page.locator('#watch-format').selectOption('pdf');
  const pdfCount = watch.filter((row) => pdfSources.has(row.sourceId)).length;
  await expect(page.locator('.watch-card:visible')).toHaveCount(
    Math.min(pageSize, pdfCount),
  );
  await expect(page.locator('.watch-cell:visible')).toHaveCount(pdfCount);
  await page.locator('#watch-search').fill('CommunisteS');
  await expect(page.locator('.watch-card:visible')).toHaveCount(1);
  await page.locator('.watch-cell:visible').click();
  await expect(page).toHaveURL(/#watch-pcf-status$/);
  await expect(page.locator('#watch-pcf-status')).toBeInViewport();
  await page.locator('#watch-search').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#watch-empty')).toBeVisible();
  await expect(page.locator('.watch-cell:visible')).toHaveCount(0);
  expect(await page.locator('img[src=x]').count()).toBe(0);
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await expect(page.locator('.watch-card:visible')).toHaveCount(
    Math.min(pageSize, watch.length),
  );
  await page.locator('#watch-state').selectOption('modifie');
  await expect(page.locator('.watch-card:visible')).toHaveCount(
    Math.min(pageSize, watch.filter((row) => row.status === 'modifie').length),
  );
  await expect(page.locator('.watch-cell:visible')).toHaveCount(
    watch.filter((row) => row.status === 'modifie').length,
  );
  await expect(page.locator('.watch-checked time')).toHaveAttribute(
    'datetime',
    watch
      .map((row) => row.checkedAt)
      .sort()
      .at(-1)!,
  );
});

test('les fiches et la matrice de veille restent consultables sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${testOrigin}/veille/`);
  await expect(page.locator('#watch-filters')).toBeHidden();
  await expect(page.locator('.watch-card:visible')).toHaveCount(watch.length);
  await expect(page.locator('.watch-cell:visible')).toHaveCount(watch.length);
  await page.locator('[data-watch-cell="pcf-status"]').click();
  await expect(page.locator('#watch-pcf-status')).toBeInViewport();
  await page.locator('#watch-pcf-status summary').click();
  await expect(page.locator('#watch-pcf-status details')).toContainText(
    'PDF officiel relu',
  );
  await context.close();
});

test('la home affiche les séries et les accès au corpus sans exemple nominatif', async ({
  page,
}) => {
  await page.goto('/breves/');
  const latestBriefs = await page
    .locator('.brief-cards a')
    .evaluateAll((links) =>
      links.slice(0, 3).map((link) => link.getAttribute('href')),
    );
  for (const width of [320, 768, 1024, 1440, 1800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const programme = (await page.locator('.programme-index').boundingBox())!;
    const dossiers = (await page.locator('.home-dossiers').boundingBox())!;
    expect(dossiers.y - programme.y - programme.height).toBeLessThanOrEqual(32);
    await expect(
      page.locator('.home-economic-signals svg[role="img"]'),
    ).toHaveCount(4);
    expect(
      await page
        .locator('.home-briefs .brief-cards a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
    ).toEqual(latestBriefs);
    const permanentSections = await page
      .locator(
        '.election-cover, .home-choices, .home-layout > :not(.home-dossiers)',
      )
      .allTextContents();
    for (const candidate of candidateRows) {
      expect(permanentSections.join(' ')).not.toContain(candidate.name);
    }
    await expect(
      page
        .getByRole('navigation', { name: 'Accès rapides' })
        .getByRole('link', {
          name: String(active.length) + ' candidats suivis',
        }),
    ).toBeVisible();
    const register = page.locator('.cover-register');
    const metrics = await register.locator('a').evaluateAll((links) =>
      links.map((link) => {
        const card = link.getBoundingClientRect();
        const value = link.querySelector('strong')!.getBoundingClientRect();
        const label = link.querySelector('span')!;
        const text = label.getBoundingClientRect();
        return {
          y: value.top,
          inset: value.left - card.left,
          below: text.top >= value.bottom,
          fits:
            link.scrollWidth <= link.clientWidth &&
            value.right <= card.right &&
            text.right <= card.right,
          lines: text.height / parseFloat(getComputedStyle(label).lineHeight),
        };
      }),
    );
    expect(metrics).toHaveLength(3);
    for (const metric of metrics) {
      expect(metric.y).toBeCloseTo(metrics[0].y, 0);
      expect(metric.inset).toBeGreaterThanOrEqual(8);
      expect(metric.below && metric.fits).toBe(true);
      expect(metric.lines).toBeLessThan(2.1);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test('le titre des courbes conserve un padding au-dessus et en dessous', async ({
  page,
}) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sondages/#enquete=elabe-2026-11-14-philippe');
    const heading = page.locator('.poll-trend > .register-heading');
    const padding = await heading.evaluate((node) => {
      const style = getComputedStyle(node);
      return [parseFloat(style.paddingTop), parseFloat(style.paddingBottom)];
    });
    expect(Math.min(...padding)).toBeGreaterThanOrEqual(14);
  }
});

test('les icônes et les compteurs de thèmes gardent leur taille et leur alignement', async ({
  page,
}) => {
  for (const width of [320, 390, 768, 901, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const brand = (await page.locator('.wordmark').boundingBox())!;
    const caption = (await page.locator('.rail-brand > p').boundingBox())!;
    expect(
      caption.x >= brand.x + brand.width + 8 ||
        caption.y >= brand.y + brand.height + 8,
      `signature à ${width}px`,
    ).toBe(true);
    for (const link of await page.locator('.theme-register > a').all()) {
      const icon = (await link.locator(':scope > .icon').boundingBox())!;
      const count = (await link.locator('.theme-count').boundingBox())!;
      const bar = (await link.locator('.theme-entry svg').boundingBox())!;
      expect(icon.width, `icône à ${width}px`).toBeGreaterThanOrEqual(29);
      expect(
        Math.abs(icon.y + icon.height / 2 - count.y - count.height / 2),
        `alignement à ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(bar.width, `barre à ${width}px`).toBeGreaterThanOrEqual(20);
    }
  }
});
