import { expect, test } from '@playwright/test';

test('la relecture du programme Dubuisson relie le dossier, la recherche et le passage exporté', async ({
  page,
  request,
}) => {
  const measureId = 'dubuisson-parquet-probite-publique';
  const measurePath = `/mesures/${measureId}/`;
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/candidats/dubuisson/');
  const review = page.getByRole('region', { name: 'Relecture du programme' });
  const chapters = review
    .locator('details')
    .filter({ hasText: 'Les treize dossiers du programme' });
  await expect(chapters.locator('summary')).toContainText(
    '13 identifiées · 13 relues · 0 à examiner',
  );
  await chapters.locator('summary').click();
  await expect(
    chapters.getByText('Sans engagement précis').first(),
  ).toBeVisible();
  await expect(
    chapters.getByRole('link', {
      name: 'Créer un parquet national de probité publique',
    }),
  ).toHaveAttribute('href', measurePath);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);

  await page.goto(
    '/recherche/#q=parquet%20national%20de%20probite%20publique&candidate=dubuisson&type=mesure',
  );
  const hit = page.locator(`main a[href="${measurePath}"]`).first();
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'parquet national de probité publique',
  );
  const { measures, sources } = await (
    await request.get('/api/corpus.json')
  ).json();
  const item = measures.find((m: { id: string }) => m.id === measureId);
  expect(item.displayAuthor).toBe('Emmanuel Dubuisson');
  const [ref] = item.sourceRefs;
  expect(ref.locator).toBe('Parquet national de probité publique');
  const source = sources.find((s: { id: string }) => s.id === ref.sourceId);
  expect(source.published).toBeNull();
  await expect(page.locator('.precise-sources a').first()).toHaveAttribute(
    'href',
    source.url + '#' + ref.fragment,
  );
});

test('réinitialiser la matrice restaure le total et retire le document de l’URL', async ({
  page,
  request,
}) => {
  const { records } = await (
    await request.get('/api/couverture-documentaire.json')
  ).json();
  const source = 'dlf-economie-2026';
  const filtered = records.filter((r: { documents: string[] }) =>
    r.documents.includes(source),
  );
  expect(filtered.length).toBeGreaterThan(0);
  expect(filtered.length).toBeLessThan(records.length);
  await page.goto('/documents/couverture/#document=' + source);
  const count = page.locator('[data-count="measures"]');
  await expect(count).toHaveText(String(filtered.length));
  await page.getByRole('button', { name: 'Tout afficher' }).click();
  await expect(page.getByLabel('Document cité')).toHaveValue('');
  await expect(count).toHaveText(String(records.length));
  await expect(page).toHaveURL(/\/documents\/couverture\/$/);
});

test('les facettes conservent quatre types de fiche et la provenance par thème', async ({
  page,
  request,
}) => {
  const { records } = await (
    await request.get('/api/couverture-documentaire.json')
  ).json();
  const candidate = 'melenchon';
  const selected = records.filter(
    (row: { candidate: string; theme: string }) =>
      row.candidate === candidate && row.theme === 'retraites',
  );
  expect(selected.length).toBeGreaterThan(0);
  await page.setViewportSize({ width: 320, height: 750 });
  await page.goto('/documents/couverture/#candidate=' + candidate);
  const theme = page.locator('.matrix-bars > [data-theme="retraites"]');
  await expect(theme.locator('[data-theme-total]')).toHaveText(
    String(selected.length),
  );
  for (const scope of ['campagne', 'parti', 'orientation', 'archive']) {
    const count = selected.filter(
      (row: { scope: string }) => row.scope === scope,
    );
    await expect(
      theme.locator('[data-theme-count="' + scope + '"]'),
    ).toHaveText(String(count.length));
  }
  const refs = new Set(
    selected.flatMap((row: { documents: string[] }) => row.documents),
  );
  await expect(theme.locator('[data-theme-count="documents"]')).toHaveText(
    String(refs.size),
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
