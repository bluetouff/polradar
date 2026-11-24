import { expect, test } from '@playwright/test';
import { testOrigin } from './origin';
import measures from '../../src/data/measures.json' with { type: 'json' };

test('le médiakit et les deux demandes restent utilisables sans JavaScript', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const foreign = new Set<string>();
    page.on('request', (req) => {
      if (new URL(req.url()).origin !== testOrigin) foreign.add(req.url());
    });
    await page.goto(testOrigin + '/presse/');
    await expect(
      page.getByRole('heading', { name: 'Espace presse', exact: true }),
    ).toBeVisible();
    const partnership = new URL(
      (await page
        .getByRole('link', { name: 'Écrire pour un partenariat' })
        .getAttribute('href'))!,
    );
    expect(partnership.protocol).toBe('mailto:');
    expect(partnership.pathname).toBe('admin@toonux.com');
    expect(partnership.searchParams.get('subject')).toContain('Partenariat');
    expect(partnership.searchParams.get('body')).toContain('Format envisagé');
    const correction = new URL(
      (await page
        .getByRole('link', { name: 'Écrire à la rédaction' })
        .getAttribute('href'))!,
    );
    expect(correction.searchParams.get('subject')).toContain('Correction');
    const note = await request.get('/presse/fiche-media.txt');
    expect(note.ok()).toBeTruthy();
    expect(await note.text()).toContain(
      measures
        .filter((m) => m.scope === 'campagne' || m.scope === 'parti')
        .length.toLocaleString('fr-FR') + ' propositions',
    );
    for (const link of await page.locator('.press-assets a[download]').all()) {
      const asset = await request.get((await link.getAttribute('href'))!);
      expect(asset.ok()).toBeTruthy();
      expect(await asset.text()).toContain('viewBox="0 0 208 48"');
    }
    const og = await request.get('/og/presse.png');
    expect(og.ok()).toBeTruthy();
    expect((await og.body()).readUInt32BE(16)).toBe(1200);
    expect([...foreign]).toEqual([]);
  } finally {
    await context.close();
  }
});
test('le soutien précède la recherche et reste visible dans les deux pieds de page', async ({
  page,
}) => {
  for (const path of ['/presse/', '/mesures/kazib-hausse-generale-salaires/']) {
    await page.goto(path);
    const header = page.locator('.publication-header');
    const link = header.getByRole('link', {
      name: 'Soutenir Polradar sur l0g.fr',
    });
    const search = header.getByRole('link', { name: 'Rechercher' });
    await expect(
      page
        .locator('.publication-footer')
        .getByRole('link', { name: 'Soutenir Polradar sur l0g.fr' }),
    ).toHaveAttribute('href', 'https://l0g.fr/soutenir/');
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(link).toBeVisible();
      await expect(search).toBeVisible();
      const a = await link.boundingBox(),
        b = await search.boundingBox();
      expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + 1);
      expect(a!.height).toBeGreaterThanOrEqual(44);
      expect(b!.x + b!.width).toBeLessThanOrEqual(width + 1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await link.focus();
      await page.keyboard.press('Tab');
      await expect(search).toBeFocused();
    }
  }
});
