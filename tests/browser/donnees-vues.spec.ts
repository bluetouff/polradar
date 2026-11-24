import { test, expect } from '@playwright/test';

test('la fiche suit un candidat ou un thème avec un index réduit et les identifiants du corpus', async ({
  page,
  request,
}) => {
  const corpus = await (await request.get('/api/corpus.json')).json();
  const choices = await (await request.get('/data/choix-suivi.json')).json();
  expect(choices.candidates).toEqual(
    corpus.candidates.map((c: { id: string }) => c.id),
  );
  expect(choices.themes).toEqual(
    corpus.themes.map((t: { id: string }) => t.id),
  );
  let large = 0;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/corpus.json') large++;
  });
  await page.goto('/mesures/attal-csg-salaires/');
  const follow = page.locator('[data-follow-kind]').first();
  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('[data-follow-kind]').first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(large).toBe(0);
});

test('la vue sondages conserve chacune des sources de sa notice et du questionnaire', async ({
  page,
  request,
}) => {
  const corpus = await (await request.get('/api/corpus.json')).json();
  const data = await (await request.get('/data/enquetes.json')).json();
  expect(data.polls).toEqual(corpus.polls);
  const urls = new Map(
    data.sources.map((s: { id: string; url: string }) => [s.id, s.url]),
  );
  const full = new Map(
    corpus.sources.map((s: { id: string; url: string }) => [s.id, s.url]),
  );
  const refs = new Set<string>();
  for (const p of data.polls)
    for (const ref of [
      p.noticeSource,
      p.resultSource,
      p.question?.sourceId,
    ].filter(Boolean))
      refs.add(ref);
  expect([...urls.keys()].sort()).toEqual([...refs].sort());
  for (const id of refs) expect(urls.get(id)).toBe(full.get(id));
  await page.route('**/api/corpus.json', (r) => r.abort());
  await page.goto('/sondages/');
  await expect(page.locator('#poll-scenario option').first()).toBeAttached();
  await expect(page.locator('#poll-method a').first()).toHaveAttribute(
    'href',
    /^https:/,
  );
});
