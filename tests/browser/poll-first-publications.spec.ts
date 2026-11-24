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
