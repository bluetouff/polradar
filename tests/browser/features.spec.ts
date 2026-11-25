import { testOrigin } from './origin';
import { test, expect } from '@playwright/test';
import measures from '../../src/data/measures.json' with { type: 'json' };
import { pageSize } from '../../src/lib/pagination';

const retirementMeasures = measures.filter(
  (m) =>
    m.candidate === 'melenchon' &&
    m.theme === 'retraites' &&
    m.scope !== 'archive',
);
const retirementPageCount = Math.min(retirementMeasures.length, pageSize);

test('les nouvelles vues restent lisibles de 320 à 1440 pixels', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/comparer/',
      '/mesures/',
      '/mesures/melenchon-retraites-1/',
      '/sondages/',
      '/marches-predictifs/',
      '/campagne/',
      '/veille/',
      '/historique/',
      '/suivi/',
      '/recherche/',
      '/themes/retraites/',
    ]) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        `${route} à ${width}px`,
      ).toBe(false);
      if (route === '/comparer/') {
        const compressed = await page
          .locator('.comparison-body .measure-content')
          .evaluateAll((nodes) =>
            nodes.some(
              (node) =>
                node.clientWidth < node.parentElement!.clientWidth * 0.8,
            ),
          );
        expect(compressed).toBe(false);
      }
      if (route === '/sondages/') {
        await page.goto('/sondages/#enquete=elabe-2026-11-14-philippe');
        await expect(page.locator('#poll-status')).toContainText('Elabe');
        await expect(page.locator('#poll-plot svg')).toBeVisible();
        const textSizes = await page
          .locator('#poll-plot .chart-tick')
          .evaluateAll((nodes) =>
            nodes.map(
              (node) =>
                parseFloat(getComputedStyle(node).fontSize) *
                (node as SVGGraphicsElement).getScreenCTM()!.a,
            ),
          );
        expect(Math.min(...textSizes)).toBeGreaterThanOrEqual(10);
        const outside = await page
          .locator('#poll-plot svg')
          .evaluate((node) => {
            const svg = node as SVGSVGElement,
              box = svg.viewBox.baseVal;
            return Array.from(svg.querySelectorAll('text')).some((text) => {
              const b = text.getBBox();
              return (
                b.x < 0 ||
                b.y < 0 ||
                b.x + b.width > box.width + 1 ||
                b.y + b.height > box.height + 1
              );
            });
          });
        expect(outside).toBe(false);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('les montants de fiscalité restent dans leur carte sur le thème et dans le comparateur', async ({
  page,
}) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/themes/fiscalite/',
      '/comparer/?theme=fiscalite&c=melenchon,roussel&archives=0',
    ]) {
      await page.goto(route);
      const panel = page
        .locator('.metric-panel')
        .filter({ hasText: 'Seuil d’exonération annoncé' });
      await expect(panel).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const row of await panel.locator('.metric-row').all()) {
        const plot = (await row.locator('svg').boundingBox())!;
        const value = (await row.locator('strong').boundingBox())!;
        const bounds = (await row.boundingBox())!;
        expect(plot.height).toBeLessThanOrEqual(32);
        expect(value.x).toBeGreaterThan(plot.x + plot.width);
        expect(value.x + value.width).toBeLessThanOrEqual(
          bounds.x + bounds.width + 1,
        );
        expect(
          await row.locator('strong').evaluate((node) => node.scrollWidth),
        ).toBeLessThanOrEqual(Math.ceil(value.width) + 1);
      }
    }
  }
});

test('plusieurs mesures restent consultables pour un candidat et un thème', async ({
  page,
}) => {
  await page.goto('/mesures/#candidate=melenchon&theme=retraites');
  await expect(page.locator('#measure-results .measure-row')).toHaveCount(
    retirementPageCount,
  );
  await expect(page.locator('#measure-results')).toContainText('60 ans');
  await page
    .getByRole('link', {
      name: 'Retraite à 60 ans et 40 annuités',
      exact: true,
    })
    .click();
  await expect(page.locator('.measure-number-grid')).toContainText('60');
  await expect(page.locator('.measure-number-grid')).toContainText('40');
  await expect(page.locator('.precise-sources')).toContainText('Garantir');
  await expect(page.locator('.measure-fields')).toContainText('Bénéficiaires');
  await expect(page.locator('.measure-fields + .source-note')).toHaveText(
    'Informations non renseignées dans cette fiche · financement annoncé.',
  );
});

test('une mesure s’ouvre au premier clic après une recherche', async ({
  page,
}) => {
  await page.goto('/mesures/#candidate=philippe&theme=retraites');
  await page.getByRole('searchbox').fill('capitalisation');
  await expect(page.locator('#measure-results .measure-row')).toHaveCount(2);
  await page
    .getByRole('link', {
      name: 'Capitalisation collective et départs anticipés',
    })
    .click();
  await expect(page).toHaveURL(/\/mesures\/philippe-retraites-2\/$/);
  await expect(page.locator('h1')).toHaveText(
    'Capitalisation collective et départs anticipés',
  );
});

test('la suppression de la CSG se retrouve dans les deux moteurs avec le bon périmètre', async ({
  page,
}) => {
  for (const pagePath of ['/recherche/', '/mesures/']) {
    await page.goto(pagePath);
    await page.getByRole('searchbox').fill('suppression de la csg');
    const links = page.locator('#search-results, #measure-results');
    await expect(
      links.locator('a[href="/mesures/attal-csg-salaires/"]').first(),
    ).toBeVisible();
    await expect(
      links.locator('a[href="/mesures/zemmour-csg-activite/"]').first(),
    ).toBeVisible();
    await expect(
      links.locator('a[href="/mesures/glucksmann-csg-salaires/"]'),
    ).toHaveCount(0);
    await page
      .getByRole('searchbox')
      .fill('baisse de la contribution sociale généralisée');
    await expect(
      links.locator('a[href="/mesures/glucksmann-csg-salaires/"]').first(),
    ).toBeVisible();
  }
});

test('la recherche combine les facettes et exporte la sélection', async ({
  page,
}) => {
  await page.goto('/recherche/');
  const form = page.locator('#search-form');
  await form.locator('#search-options summary').click();
  await form.locator('[name=candidate]').selectOption('melenchon');
  await form.locator('[name=theme]').selectOption('retraites');
  await form.locator('[name=type]').selectOption('mesure');
  await expect(page.locator('#search-results .advanced-result')).toHaveCount(
    retirementPageCount,
  );
  await page.getByRole('searchbox').fill('retraite');
  await expect(page).toHaveURL(/#.*candidate=melenchon/);
  expect(new URL(page.url()).search).toBe('');
  const download = page.waitForEvent('download');
  await page.locator('#export-json').click();
  const file = await download,
    stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const rows = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(rows.map((row: { url: string }) => row.url).sort()).toEqual(
    retirementMeasures.map((m) => `/mesures/${m.id}/`).sort(),
  );
  expect(
    rows.every(
      (row: { candidate: string; theme: string }) =>
        row.candidate === 'melenchon' && row.theme === 'retraites',
    ),
  ).toBe(true);
  await page.reload();
  await expect(form.locator('[name=candidate]')).toHaveValue('melenchon');
  await expect(page.locator('#search-results .advanced-result')).toHaveCount(
    retirementPageCount,
  );
});

test('les paramètres de recherche hostiles restent inertes', async ({
  page,
}) => {
  await page.goto(
    '/recherche/#q=%3Cimg%20src=x%20onerror=alert(1)%3E&candidate=__proto__&theme=%3Cscript%3E',
  );
  await expect(page.locator('#search-count')).toHaveText('0 résultat');
  expect(await page.locator('img[src=x],script[src=x]').count()).toBe(0);
});

test('l’historique montre les champs ajoutés entre deux versions', async ({
  page,
}) => {
  await page.goto('/historique/?mesure=melenchon-retraites-1&avant=1&apres=2');
  await expect(page.locator('.version-pill')).toHaveText(['V1', 'V2']);
  await expect(page.locator('#history-status')).toContainText(
    'versions 1 et 2',
  );
  await expect(
    page
      .locator('.diff-field')
      .filter({
        has: page.getByRole('heading', { name: 'Bénéficiaires', exact: true }),
      })
      .locator('.diff-before'),
  ).toContainText('Non renseigné');
  await expect(
    page
      .locator('.diff-field')
      .filter({
        has: page.getByRole('heading', { name: 'Bénéficiaires', exact: true }),
      })
      .locator('.diff-after'),
  ).toContainText('Assurés');
  await page.locator('#history-before').selectOption('2');
  await expect(page.locator('#history-result')).toContainText(
    'Une seule version est sélectionnée',
  );
});

test('le suivi persiste localement puis s’efface', async ({ page }) => {
  await page.goto('/suivi/');
  const button = page.locator(
    '[data-follow-kind=candidate][data-follow-id=philippe]',
  );
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('#follow-results .measure-row').first(),
  ).toContainText('Philippe');
  await expect(
    page.locator('#follow-feeds a[href="/rss/candidats/philippe.xml"]'),
  ).toBeVisible();
  await page.reload();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/candidats/philippe/');
  await expect(page.locator('[data-follow-id=philippe]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto('/suivi/');
  await page.locator('#follow-clear').click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(
    await page.evaluate(() => localStorage.getItem('polradar.follow.v1')),
  ).toBeNull();
});

test('le suivi reste utilisable lorsque le stockage est bloqué', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Stockage bloqué', 'SecurityError');
      },
    }),
  );
  await page.goto('/suivi/');
  await expect(page.locator('#follow-status')).toContainText('indisponible');
  await page.locator('[data-follow-id=philippe]').click();
  await expect(page.locator('[data-follow-id=philippe]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(
    page.locator('#follow-results .measure-row').first(),
  ).toContainText('Philippe');
});

test('un refus d’écriture du stockage est signalé', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(Storage.prototype, 'setItem', {
      value() {
        throw new DOMException('Quota', 'QuotaExceededError');
      },
    }),
  );
  await page.goto('/suivi/');
  await expect(page.locator('#follow-status')).toContainText('indisponible');
  await page.locator('[data-follow-id=philippe]').click();
  await expect(page.locator('[data-follow-id=philippe]')).toContainText(
    'Suivi temporaire',
  );
  await expect(
    page.locator('#follow-results .measure-row').first(),
  ).toContainText('Philippe');
});

test('un échec d’effacement est indiqué sans annoncer une suppression', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'polradar.follow.v1',
      JSON.stringify({ candidates: ['philippe'], themes: [], lastVisit: null }),
    );
    Object.defineProperty(Storage.prototype, 'removeItem', {
      value() {
        throw new DOMException('Blocage', 'SecurityError');
      },
    });
  });
  await page.goto('/suivi/');
  await expect(page.locator('[data-follow-id=philippe]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#follow-clear').click();
  await expect(page.locator('#follow-status')).toContainText(
    'L’effacement du stockage a échoué',
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('polradar.follow.v1')!).candidates,
    ),
  ).toEqual(['philippe']);
});

test('les sondages séparent les tours et permettent de choisir une vague', async ({
  page,
}) => {
  await page.goto('/sondages/#enquete=elabe-2026-11-14-philippe');
  await expect(page.locator('#poll-status')).toContainText('Elabe');
  await expect(page.locator('#poll-plot .poll-chart')).toHaveAttribute(
    'role',
    'group',
  );
  await expect(page.locator('#poll-bars .poll-bar-row')).toHaveCount(11);
  await expect(page.locator('#poll-plot circle')).toHaveCount(0);
  const wave = page.locator('#poll-plot .plot-wave').first();
  await wave.focus();
  await page.keyboard.press('Enter');
  await expect(wave).toHaveAttribute('aria-pressed', 'true');
  await expect(wave).toBeFocused();
  await expect(page.locator('#poll-wave')).toHaveValue('0');
  await page.locator('#poll-wave').focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await expect(page.locator('#poll-wave')).toHaveValue('0');
  await expect(page.locator('#poll-selected-date')).toContainText('août');
  await expect(page.locator('#poll-method')).toContainText(
    'Non précisé pour cette question',
  );
  await page.locator('#poll-options summary').click();
  await page.locator('#poll-round').selectOption('second');
  await page
    .locator('#poll-scenario')
    .selectOption('elabe-2026-08-29-duel-glucksmann');
  await expect(page.locator('#poll-bars .poll-bar-row')).toHaveCount(2);
  await expect(page.locator('#poll-bars')).toContainText('Glucksmann');
  await expect(page.locator('#poll-method')).toContainText('952');
  await expect(page.locator('#poll-method')).toContainText('page 10');
  const download = page.waitForEvent('download');
  await page.locator('#poll-export').click();
  expect((await download).suggestedFilename()).toContain('elabe');
});

test('les flux RSS sont valides, ciblés et gardent la précision des dates', async ({
  page,
  request,
}) => {
  await page.goto('/suivi/');
  const candidate = await request.get('/rss/candidats/philippe.xml'),
    theme = await request.get('/rss/themes/retraites.xml');
  expect(candidate.ok() && theme.ok()).toBe(true);
  for (const [response, name] of [
    [candidate, 'Édouard Philippe'],
    [theme, 'Retraites'],
  ] as const) {
    const xml = await response.text();
    const parsed = await page.evaluate((text) => {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      return {
        error: !!doc.querySelector('parsererror'),
        items: Array.from(doc.querySelectorAll('item')).map((item) => ({
          title: item.querySelector('title')?.textContent || '',
          description: item.querySelector('description')?.textContent || '',
          date: item.querySelector('pubDate')?.textContent || '',
        })),
      };
    }, xml);
    expect(parsed.error).toBe(false);
    expect(parsed.items.length).toBeGreaterThan(1);
    expect(
      parsed.items.every((item) =>
        `${item.title} ${item.description}`.includes(name),
      ),
    ).toBe(true);
    expect(parsed.items.some((item) => !item.date)).toBe(true);
    expect(parsed.items.some((item) => !!item.date)).toBe(true);
  }
});

test('les intégrations n’appellent aucun tiers et respectent la CSP', async ({
  page,
}) => {
  const external: string[] = [],
    csp: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(`${testOrigin}/`))
      external.push(request.url());
  });
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /Content Security Policy|Refused to|violates/i.test(message.text())
    )
      csp.push(message.text());
  });
  for (const route of [
    '/sondages/',
    '/mesures/',
    '/historique/',
    '/suivi/',
    '/recherche/',
  ]) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
  }
  expect(external).toEqual([]);
  expect(csp).toEqual([]);
});

test('les vues initiales et les notices restent disponibles sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 320, height: 900 },
    }),
    page = await context.newPage();
  await page.goto(`${testOrigin}/sondages/`);
  await expect(page.locator('.poll-workspace')).toHaveAttribute(
    'data-mode',
    'snapshot',
  );
  await expect(page.locator('#poll-trend')).toBeHidden();
  await expect(page.locator('#poll-plot svg')).toHaveCount(0);
  await expect(page.locator('#poll-bars .poll-bar-row').first()).toBeVisible();
  await expect(
    page
      .locator('#poll-method')
      .getByRole('link', { name: /^Notice officielle, page \d+/ }),
  ).toBeVisible();
  await page.goto(`${testOrigin}/mesures/melenchon-retraites-1/`);
  await expect(page.locator('.measure-number-grid')).toContainText('60');
  await expect(page.locator('.version-timeline li')).toHaveCount(2);
  await context.close();
});

test('les nouvelles fiches gardent les grands nombres lisibles', async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/mesures/ruffin-logement-renovations/',
      '/mesures/melenchon-fiscalite-heritage-maximal/',
      '/mesures/philippe-fiscalite-effectifs-publics/',
    ]) {
      await page.goto(route);
      await expect(page.locator('.measure-number-grid')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        `${route} à ${width}px`,
      ).toBe(false);
    }
  }
});

test('le déficit corrigé conserve sa version précédente et ses dates', async ({
  page,
}) => {
  await page.goto('/mesures/philippe-fiscalite-1/');
  await expect(page.locator('h1')).toContainText('2,5 %');
  await expect(page.locator('.page-title')).toContainText(
    'Campagne présidentielle 2027',
  );
  await expect(page.locator('.page-title')).not.toContainText(
    'Programme du 12',
  );
  await expect(
    page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { name: 'Références', exact: true }),
      })
      .locator('.precise-sources'),
  ).toContainText('Mise à jour du document : 16 novembre 2026');
  await page.goto('/historique/?mesure=philippe-fiscalite-1&avant=1&apres=2');
  await expect(page.locator('.diff-after').first()).toContainText('2,5 %');
  await expect(page.locator('.diff-before').first()).toContainText('2 %');
  await page.goto('/sources/');
  await page
    .locator('#sources-list-filters input')
    .fill('Édouard Philippe : école');
  const row = page.locator('.source-card').filter({
    has: page.getByRole('link', { name: 'Édouard Philippe : école' }),
  });
  await expect(
    row.getByText('Mise à jour du document', { exact: true }).locator('+ dd'),
  ).toHaveText('18 novembre 2026');
  await expect(
    row.getByText('Publication', { exact: true }).locator('+ dd'),
  ).toHaveText('Date non indiquée');
});
