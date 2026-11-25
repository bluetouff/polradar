import { testOrigin } from './origin';
import { openDossier } from './dossier-directory';
import { test, expect } from '@playwright/test';
import legislativeVotes from '../../src/data/legislative-votes.json' with { type: 'json' };
import { chambers, positionLabel } from '../../src/lib/legislative-votes.mjs';
import { socialImages } from '../../src/lib/social-images.mjs';

test('les thèmes, les sources et la recherche utilisent la largeur disponible', async ({
  page,
}) => {
  for (const [width, minimum] of [
    [1440, 3],
    [390, 1],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, grid] of [
      ['/themes/fiscalite/', '.measure-list'],
      ['/recherche/#q=retraites', '#search-results'],
      ['/sources/', '.sources-grid'],
    ]) {
      await page.goto(route);
      if (route.startsWith('/recherche/'))
        await expect(
          page.locator('#search-results .advanced-result').first(),
        ).toBeVisible();
      if (route === '/themes/fiscalite/') {
        await expect(
          page.locator('[data-scope="campagne"] .measure-author img').first(),
        ).toBeVisible();
        await expect(
          page.locator('[data-scope="parti"] .measure-author'),
        ).toHaveCount(0);
        const reference = page
          .locator('.measure-links a[href$="#sources"]')
          .first();
        await expect(reference).toHaveText(/\d+ sources?/);
        await reference.click();
        await expect(page.locator('#sources')).toHaveText('Références');
        await page.goBack();
      }
      const columns = await page
        .locator(grid)
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
        );
      if (width === 390) expect(columns).toBe(1);
      else expect(columns).toBeGreaterThanOrEqual(minimum);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
});

test('la frise conserve les objets des motions, les sources et les liens directs', async ({
  page,
}) => {
  await page.goto('/votes/');
  await expect(page.locator('[data-vote-case]')).toHaveCount(0);
  await expect(page.locator('.dossier-directory img')).toHaveCount(0);
  await expect(page.locator('.subject-card:visible')).toHaveCount(12);
  await expect(page.locator('.subject-card')).toHaveCount(
    legislativeVotes.cases.length,
  );
  await openDossier(page, '[data-vote-tab="melenchon-isf"]');
  await expect(page).toHaveURL(/\/votes\/dossiers\/melenchon-isf\/$/);
  const dossier = page.locator('[data-vote-case]:visible');
  await expect(dossier).toContainText('Jean-Luc Mélenchon');
  await expect(dossier.locator('.personal-choice')).toHaveText([
    'Contre l’article',
    'Contre la motion',
  ]);
  await expect(dossier.locator('[data-ballot="an15-1716"]')).toContainText(
    'Motion adoptée',
  );
  await dossier.locator('.vote-source').first().locator('summary').click();
  await expect(dossier.locator('.vote-source[open] a').first()).toHaveAttribute(
    'href',
    'https://www.assemblee-nationale.fr/dyn/15/scrutins/169',
  );
  await page.getByRole('link', { name: 'Tous les dossiers de vote' }).click();
  await openDossier(page, '[data-vote-tab="roussel-retraites"]');
  await expect(page.locator('[data-vote-case]:visible')).toContainText(
    'Pour la motion',
  );
  await expect(page.locator('[data-vote-case]:visible')).toContainText(
    'Majorité requise : 287',
  );
  await expect(
    page.locator('[data-vote-case]:visible .ballot-tally > span'),
  ).toHaveCount(1);
  const dots = page.locator('[data-vote-case]:visible .ballot-chart svg path');
  await expect(dots).toHaveCount(1);
  expect((await dots.getAttribute('d'))?.match(/M\d+ \d+h0/g)).toHaveLength(
    278,
  );
  await page.reload();
  await expect(page.locator('h1')).toHaveText(
    legislativeVotes.cases.find((c) => c.id === 'roussel-retraites')!.title,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://polradar.fr/votes/dossiers/roussel-retraites/',
  );
  await page.goto('/votes/#dossier=melenchon-isf&scrutin=an15-1716');
  await expect(page).toHaveURL(
    /\/votes\/dossiers\/melenchon-isf\/#scrutin-an15-1716$/,
  );
  await expect(page.locator(':target')).toHaveAttribute(
    'data-ballot',
    'an15-1716',
  );
  await page.goto('/votes/#dossier=%3Cimg%20src=x%20onerror=alert(1)%3E');
  await expect(page.locator('[data-vote-case]:visible')).toHaveCount(0);
  await expect(page.locator('[data-votes-workspace] img[src="x"]')).toHaveCount(
    0,
  );
});

test.describe('scrutins sur les fiches de mesures', () => {
  test.use({ javaScriptEnabled: false });

  test('chaque rapprochement publié donne son objet, son votant et la liste officielle', async ({
    page,
  }) => {
    const measures = new Set(
      legislativeVotes.cases.map((record) => record.measureId),
    );
    for (const id of measures) {
      const records = legislativeVotes.cases.filter(
        (record) => record.measureId === id,
      );
      await page.goto(`/mesures/${id}/#scrutins`);
      const section = page.getByRole('region', { name: 'Scrutins nominatifs' });
      await expect(section.locator('[data-ballot]')).toHaveCount(
        records.flatMap((record) => record.links).length,
      );
      for (const record of records) {
        const group = section.locator('.vote-case').filter({
          has: page.locator(`a[href="/votes/dossiers/${record.id}/"]`),
        });
        for (const link of record.links) {
          const b = legislativeVotes.ballots.find(
            (ballot) => ballot.id === link.ballotId,
          )!;
          const source =
            legislativeVotes.readingSources.find((s) => s.ballotId === b.id) ??
            b.source;
          const pos = b.positions.find(
            (p) => p.candidate === record.candidate,
          )!;
          const card = group.locator(`[data-ballot="${b.id}"]`);
          await expect(card.getByRole('heading', { level: 3 })).toHaveText(
            b.title,
          );
          await expect(card.locator('time')).toHaveAttribute(
            'datetime',
            b.date,
          );
          await expect(card.locator('.session')).toContainText(
            chambers[b.chamber as keyof typeof chambers],
          );
          await expect(card.locator('.choice')).toContainText(
            pos.officialName.replace(/^(M\.|Mme)\s+/, ''),
          );
          await expect(card.locator('.choice strong')).toHaveText(
            positionLabel(pos, b),
          );
          await expect(card.locator('.scope')).toHaveText(link.context);
          await expect(
            card.getByRole('link', { name: /Liste nominative officielle/ }),
          ).toHaveAttribute('href', source.url);
        }
      }
    }
    await page.goto('/mesures/melenchon-retraites-1/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('#scrutins')).toHaveCount(0);
  });

  test('chaque dossier publie sa frise, sa version et toutes les sources dans le HTML', async ({
    page,
  }) => {
    for (const record of legislativeVotes.cases) {
      const path = '/votes/dossiers/' + record.id + '/';
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveText(record.title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://polradar.fr' + path,
      );
      const timeline = page.locator('.vote-timeline');
      await expect(timeline.locator('article[data-ballot]')).toHaveCount(
        record.links.length,
      );
      await expect(timeline.locator('.vote-measure-link')).toHaveAttribute(
        'href',
        '/mesures/' + record.measureId + '/#scrutins',
      );
      for (const link of record.links) {
        const ballot = legislativeVotes.ballots.find(
          (b) => b.id === link.ballotId,
        )!;
        const article = timeline.locator('[id="scrutin-' + ballot.id + '"]');
        const source =
          legislativeVotes.readingSources.find(
            (s) => s.ballotId === ballot.id,
          ) ?? ballot.source;
        await expect(article).toContainText(link.context);
        await expect(
          article.getByRole('link', {
            name: 'Scrutin et liste nominative',
            includeHidden: true,
          }),
        ).toHaveAttribute('href', source.url);
      }
    }
    await page.goto('/votes/');
    const independent = page.locator('.roll-cards article[id]').first();
    const id = await independent.getAttribute('id');
    await page.goto('/votes/#' + id);
    await expect(page.locator(':target')).toHaveAttribute('id', id!);
    await expect(
      page
        .locator(':target')
        .getByRole('link', { name: /Liste nominative officielle/ }),
    ).toBeVisible();
  });

  test('la fiche et le dossier exact se rejoignent au clavier sur mobile, y compris pour une version antérieure', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/mesures/attal-travail-2/#scrutins');
    const section = page.locator('#scrutins');
    await expect(section.locator('.case-links')).toContainText(
      'fiche actuelle · v2',
    );
    const version = section.getByRole('link', { name: 'Version comparée · 1' });
    await version.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(':target')).toHaveAttribute('id', 'version-1');
    const dossier = section.getByRole('link', { name: /Dossier de vote/ });
    await dossier.focus();
    await page.keyboard.press('Enter');
    const selected = page.locator('[data-vote-case]:visible');
    await expect(selected).toHaveAttribute(
      'data-vote-case',
      'attal-code-travail',
    );
    await selected.locator('.vote-measure-link').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(':target')).toHaveAttribute('id', 'scrutins');
    await page.goto('/mesures/ruffin-fiscalite-1/#scrutins');
    await expect(page.locator('#scrutins [data-ballot]')).toHaveCount(3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
});

test('les votes restent accessibles sans JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/votes/');
  await expect(page.locator('.subject-card:visible')).toHaveCount(
    legislativeVotes.cases.length,
  );
  await page.goto('/votes/#dossier=melenchon-isf');
  await expect(page.locator(':target')).toHaveAttribute(
    'href',
    '/votes/dossiers/melenchon-isf/',
  );
  await page.locator(':target').click();
  await expect(page.locator('[data-vote-case]:visible')).toHaveCount(1);
  await expect(page.locator('.vote-proposal')).toHaveCount(1);
  await page
    .locator('[data-vote-case]:visible .vote-source summary')
    .first()
    .click();
  await expect(page.locator('.vote-source[open]')).toHaveCount(1);
  await context.close();
});

test('les cinq liens de partage restent statiques, canoniques et sans appel aux plateformes', async ({
  page,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== testOrigin) external.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/votes/?utm_source=secret#dossier=roussel-retraites');
  await expect(page).toHaveURL(/\/votes\/dossiers\/roussel-retraites\/$/);
  const links = page.locator('.page-share a');
  await expect(links).toHaveCount(5);
  const hrefs = await links.evaluateAll((nodes) =>
    nodes.map((node) => ({
      href: (node as HTMLAnchorElement).href,
      rel: (node as HTMLAnchorElement).rel,
      referrer: (node as HTMLAnchorElement).referrerPolicy,
    })),
  );
  for (const link of hrefs) {
    const url = new URL(link.href);
    const values = [...url.searchParams.values()].join(' ');
    expect(values).toContain(
      'https://polradar.fr/votes/dossiers/roussel-retraites/',
    );
    expect(values).not.toContain('secret');
    expect(values).not.toContain('#dossier');
    expect(link.rel).toContain('noreferrer');
    expect(link.referrer).toBe('no-referrer');
  }
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('chaque rubrique sert ses métadonnées et un PNG OG 1200 × 630', async ({
  page,
  request,
}) => {
  const images = new Set<string>();
  for (const card of socialImages) {
    await page.goto(card.path);
    const url = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content');
    expect(url).toBe('https://polradar.fr' + card.url);
    images.add(url!);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      url!,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    await expect(
      page.locator('meta[property="og:image:width"]'),
    ).toHaveAttribute('content', '1200');
    const response = await request.get(card.url);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const png = await response.body();
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }
  expect(images.size).toBe(socialImages.length);
});

test('la frise et les partages gardent leurs marges de 320 à 1800 pixels', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [320, 390, 768, 1024, 1440, 1800]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      '/votes/#dossier=philippe-retraites',
      '/votes/#dossier=roussel-retraites',
      '/',
    ]) {
      await page.goto(route);
      if (route.startsWith('/votes/'))
        await expect(page).toHaveURL(/\/votes\/dossiers\/[a-z-]+\/$/);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width} ${route}`,
      ).toBe(true);
      const outside = await page.locator('main svg:visible').evaluateAll(
        (nodes) =>
          nodes.filter((node) => {
            const r = node.getBoundingClientRect();
            return r.left < 0 || r.right > innerWidth + 1;
          }).length,
      );
      expect(outside, `${width} ${route} SVG`).toBe(0);
      const targets = await page
        .locator('.page-share a')
        .evaluateAll((nodes) =>
          nodes.every((node) => node.getBoundingClientRect().height >= 44),
        );
      expect(targets).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
