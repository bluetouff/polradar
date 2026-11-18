import { test, expect } from '@playwright/test';
test('l’évolution compare les documents, conserve les conditions et partage les états choisis', async ({
  page,
}) => {
  await page.goto('/evolution/');
  await expect(page.locator('[data-evolution-dossier]:visible')).toHaveCount(1);
  await expect(page.locator('[data-proposal-state]:visible')).toHaveCount(2);
  await expect(page.locator('[data-comparison-label]:visible')).toContainText(
    '+300 €',
  );
  await page
    .locator('[data-evolution-dossier]:visible [data-state-to]')
    .selectOption('melenchon-smic-nfp-2024');
  await expect(page.locator('[data-comparison-label]:visible')).toContainText(
    '+200 €',
  );
  await page.reload();
  await expect(
    page.locator('[data-evolution-dossier]:visible [data-state-to]'),
  ).toHaveValue('melenchon-smic-nfp-2024');
  await page.locator('[data-evidence-tab="lisnard-perimetres"]').click();
  await expect(page.locator('[data-comparison-label]:visible')).toHaveText(
    'Périmètres distincts',
  );
  await expect(page.locator('.reported-note:visible')).toContainText(
    'reprise par le parti',
  );
  await page.locator('[data-evidence-tab="melenchon-autonomie"]').click();
  await expect(page.locator('[data-comparison-label]:visible')).toHaveText(
    'Conditions à comparer',
  );
  await expect(page.locator('[data-proposal-state]:visible')).toHaveCount(2);
});
test('les flux gardent les parts publiées et leurs sources accessibles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/financements/#carte=philippe-effort');
  const dossier = page.locator('[data-financing-map]:visible');
  await expect(dossier).toContainText('≈ 150 Md€');
  await expect(dossier.locator('.flow-leaf-amount')).toHaveText([
    '50 %',
    '25 %',
    '25 % · hypothèse',
  ]);
  await dossier.locator('.financing-flow [data-flow-node="2"]').last().click();
  await expect(dossier.locator('.finance-source')).toHaveAttribute('open', '');
  await expect(dossier.locator('[data-flow-selection]')).toContainText('25 %');
  await page.locator('[data-evidence-tab="ruffin-defense-ia"]').click();
  await expect(
    page.locator('[data-financing-map]:visible .flow-unquantified'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-financing-map]:visible .flow-leaf-amount'),
  ).toHaveText('Quote-part non chiffrée');
});
test('les graphiques et le nouveau cadre restent contenus de 320 à 1800 pixels avec une CSP active', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [320, 390, 768, 1024, 1440, 1800]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      '/',
      '/evolution/',
      '/financements/#carte=philippot-recettes',
    ]) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${width} ${route}`,
      ).toBe(true);
      const clipped = await page
        .locator('.financing-flow:visible')
        .evaluateAll((nodes) =>
          nodes.flatMap((svg) => {
            const v = (svg as SVGSVGElement).viewBox.baseVal;
            return [...svg.querySelectorAll('text')]
              .filter((t) => {
                const b = t.getBBox();
                return (
                  b.x < 0 ||
                  b.y < 0 ||
                  b.x + b.width > v.width + 0.1 ||
                  b.y + b.height > v.height + 0.1
                );
              })
              .map((t) => t.textContent);
          }),
        );
      expect(clipped).toEqual([]);
      expect(
        await page
          .locator('meta[http-equiv="content-security-policy"]')
          .getAttribute('content'),
      ).not.toMatch(/unsafe-inline|unsafe-eval/);
    }
  }
  expect(errors).toEqual([]);
});
test('tous les dossiers et les documents sont lisibles sans JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/evolution/');
  await expect(page.locator('[data-evolution-dossier]:visible')).toHaveCount(6);
  await expect(page.locator('[data-proposal-state]:visible')).toHaveCount(14);
  await page.goto('http://127.0.0.1:4321/financements/');
  await expect(page.locator('[data-financing-map]:visible')).toHaveCount(16);
  await page.locator('.finance-source summary').first().click();
  await expect(page.locator('.finance-source[open] a').first()).toHaveAttribute(
    'href',
    /^https:\/\//,
  );
  await context.close();
});
test('les nouveaux flux distinguent le total publié et la somme des postes sur mobile et desktop', async ({
  page,
}) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [id, total, sum] of [
      ['melenchon-investissement-btp', '12 Md€', '12,01 Md€'],
      ['melenchon-investissement-auto', '1,4 Md€', '1,37 Md€'],
      ['mikolajczak-canicules', '9,5 Md€', '9,45 Md€'],
    ]) {
      await page.goto(`/financements/#carte=${id}`);
      const figure = page.locator(
        '[data-financing-map]:visible .financing-figure',
      );
      await expect(figure.locator('.flow-source-difference')).toContainText(
        `Total publié : ${total}`,
      );
      await expect(figure.locator('.flow-source-difference')).toContainText(
        `Somme des postes : ${sum}`,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
});
test('le choix compact sur mobile conserve le lien partagé sans imposer seize cartes avant le graphique', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/financements/');
  const chooser = page.locator('[data-evidence-select]');
  await expect(chooser).toBeVisible();
  await chooser.selectOption('mikolajczak-transition');
  await expect(page.locator('[data-financing-map]:visible')).toHaveAttribute(
    'data-financing-map',
    'mikolajczak-transition',
  );
  await page.reload();
  await expect(chooser).toHaveValue('mikolajczak-transition');
});
