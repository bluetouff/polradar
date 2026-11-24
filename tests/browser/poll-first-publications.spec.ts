import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('la première diffusion suit le scénario sur la page, dans le JSON et dans le CSV', async ({
  page,
  request,
}) => {
  const example = 'elabe-2026-11-14-philippe';
  const data = await (await request.get('/api/corpus.json')).json();
  const known = data.polls.find((p: { id: string }) => p.id === example);
  expect(known.firstPublication.media).toBe('elabe.fr');
  const unknown = data.polls.find(
    (p: { firstPublication: { status: string } }) =>
      p.firstPublication.status === 'inconnue',
  );
  const read = async (id: string) => {
    await page.goto('/sondages/#enquete=' + id);
    await page.reload();
    return page
      .locator('#poll-method dt')
      .filter({ hasText: 'Première diffusion' })
      .locator('..');
  };
  const detail = await read(example);
  await expect(detail).toContainText('elabe.fr');
  await expect(detail).toContainText('14 novembre 2026');
  await expect(detail.getByRole('link')).toHaveAttribute(
    'href',
    known.firstPublication.sourceUrl,
  );
  const downloading = page.waitForEvent('download');
  await page.locator('#poll-export').click();
  const file = await (await downloading).path();
  expect(file).toBeTruthy();
  const csv = await readFile(file!, 'utf8');
  expect(csv).toContain('Média de première diffusion');
  expect(csv).toContain(known.firstPublication.media);
  expect(csv).toContain(known.firstPublication.sourceUrl);
  if (unknown)
    await expect(await read(unknown.id)).toContainText(
      'Média et date non établis.',
    );
});

test('l’article de Sud Radio et son horodatage figurent dans le scénario, le CSV et le registre statique', async ({
  page,
  request,
  browser,
}) => {
  const corpus = await (await request.get('/api/corpus.json')).json();
  const poll = corpus.polls.find(
    (p: { surveyId: string }) => p.surveyId === 'ifop-sud-radio-2026-11-02',
  );
  const article = poll.publicationDocuments.find(
    (d: { kind: string }) => d.kind === 'article',
  );
  expect(article.date).toBe('2026-11-20');
  expect(article.localTime).toBe('14:42');
  await page.goto('/sondages/#enquete=' + poll.id);
  const method = page.locator('#poll-method');
  await expect(
    method.getByRole('link', { name: 'Article · Sud Radio' }),
  ).toHaveAttribute('href', article.url);
  await expect(method).toContainText('20 novembre 2026 à 14:42');
  await expect(method).toContainText('Média et date non établis.');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#poll-export').click();
  const file = await (await downloadEvent).path();
  expect(await readFile(file!, 'utf8')).toContain(article.url);
  const withoutJs = await browser.newContext({ javaScriptEnabled: false });
  try {
    const staticPage = await withoutJs.newPage();
    await staticPage.goto(new URL('/sondages/', page.url()).href);
    const registry = staticPage.locator('#publications-enquetes');
    await registry.locator('summary').click();
    const row = registry.locator('[data-survey="ifop-sud-radio-2026-11-02"]');
    await expect(
      row.getByRole('link', { name: 'Article · Sud Radio' }),
    ).toHaveAttribute('href', article.url);
    await expect(row).toContainText('Première diffusion non établie.');
    await expect(
      registry.locator('[data-survey="ipsos-bva-2026-10-21"]'),
    ).toContainText('17:00');
    await expect(
      registry.locator('[data-survey="opinionway-cnews-2026-11-10"]'),
    ).toContainText('Notice · OpinionWay pour CNEWS');
  } finally {
    await withoutJs.close();
  }
});

test('un scénario historique s’ouvre dans le graphique et le téléchargement JSON porte sur la sélection', async ({
  page,
}) => {
  const id = 'opinionway-commission-10333-p13';
  await page.goto('/sondages/');
  const list = page
    .locator('details')
    .filter({
      has: page.locator('summary', {
        hasText: 'Notices et scénarios intégrés',
      }),
    });
  await list.locator('summary').click();
  await list.locator(`a[href="#enquete=${id}"]`).click();
  await expect(page.locator('#poll-bar-date')).toContainText(
    'Jean-Luc Mélenchon contre Marine Le Pen',
  );
  await expect(page.locator('#poll-embed-link')).toBeHidden();
  await expect(page.locator('#poll-bars')).toContainText('69');
  const downloaded = page.waitForEvent('download');
  await page.locator('#poll-export-json').click();
  const file = await downloaded;
  const data = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(data.scenario.id).toBe(id);
  expect(
    data.scenario.results.find((r: { id: string }) => r.id === 'lepen')
      .percentage,
  ).toBe(69);
  expect(data.sources[0].url).toMatch(/commission-des-sondages.fr/);
});
