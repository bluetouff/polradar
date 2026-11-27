import { expect, test } from '@playwright/test';

const ids = [
  'lepen',
  'melenchon',
  'lisnard',
  'philippe',
  'glucksmann',
  'ruffin',
];
const question = 'climat-production-nucleaire';

test('le comparateur conserve six candidatures, leur ordre et leur statut sur mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 820 });
  const cards = page.locator('.comparison-card');
  const people = page.locator('.compare-person select');
  await page.goto(
    '/comparer/#comparaison?question=' +
      question +
      '&c=' +
      ids.slice(0, 3).join(','),
  );
  await expect(cards).toHaveCount(3);
  for (let i = 3; i < ids.length; i++) {
    await page.getByRole('button', { name: 'Ajouter une candidature' }).click();
    await expect(people.nth(i)).toBeFocused();
    await people.nth(i).selectOption(ids[i]);
    await expect(cards).toHaveCount(i + 1);
  }
  await expect(cards.last()).toContainText('Candidature retirée');
  await expect(
    page.getByText('Complément ·', { exact: false }).first(),
  ).toBeVisible();
  const selected = [...ids.slice(0, -2), ids[5], ids[4]];
  await page.getByRole('button', { name: 'Remonter la candidature 6' }).focus();
  await page.keyboard.press('Enter');
  await expect(people.nth(4)).toBeFocused();
  await expect(cards.nth(4)).toHaveAttribute('id', 'comparaison-ruffin');
  await page.locator('#compare-question-detail').click();
  await page.getByRole('link', { name: /Reprendre la comparaison/ }).click();
  await expect(cards).toHaveCount(6);
  const current = await cards.evaluateAll((nodes) =>
    nodes.map((n) => n.id.replace('comparaison-', '')),
  );
  expect(current).toEqual(selected);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page
    .getByRole('button', { name: 'Enregistrer la comparaison' })
    .click();
  await expect(page.locator('#comparison-feedback')).toContainText(
    'enregistrée dans Mon suivi',
  );
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter en JSON' }).click();
  const stream = await (await waiting).createReadStream();
  const chunks: Buffer[] = [];
  for await (const part of stream!) chunks.push(Buffer.from(part));
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(exported.candidates).toEqual(selected);
  expect(exported.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
  expect(exported.coverage[4].withdrawnOn).toBe('2026-11-21');
  expect(exported.complements.length).toBeGreaterThan(0);
  expect(exported.versions.map(({ id }: { id: string }) => id)).toContain(
    'groupe-rn-accroitre-production-nucleaire-2025-v1',
  );
  await page.getByRole('button', { name: 'Retirer la candidature 5' }).click();
  await expect(cards).toHaveCount(5);
  await expect(cards.last()).toHaveAttribute('id', 'comparaison-glucksmann');
});

test('un lien conserve deux candidatures valides et signale les identifiants rejetés', async ({
  page,
}) => {
  await page.goto('/comparer/?c=lepen,inconnu,lepen,lisnard');
  await expect(page.locator('.comparison-card')).toHaveCount(2);
  await expect(page.locator('#comparison-selection-note')).toBeVisible();
});

test('la recherche de candidatures accepte les accents et une faute puis applique un choix explicite', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/comparer/');
  const first = page.getByRole('button', { name: 'Chercher la candidature 1' });
  const second = page.getByRole('button', {
    name: 'Chercher la candidature 2',
  });
  const dialog = page.getByRole('dialog');
  const input = dialog.getByRole('searchbox', { name: 'Prénom ou nom' });
  const choices = dialog.getByRole('list').getByRole('button');
  const people = page.locator('.compare-person select');
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await first.focus();
  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await input.fill('melenchn');
  await expect(choices.first()).toHaveText('Jean-Luc Mélenchon');
  await input.fill('melenchon jean');
  await expect(choices.first()).toHaveText('Jean-Luc Mélenchon');
  await input.fill('Raphael');
  await expect(choices.first()).toHaveText('Raphaël Glucksmann');
  await input.fill('glucskmann');
  await expect(choices.first()).toHaveText('Raphaël Glucksmann');
  await expect(people.first()).toHaveValue('');
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await input.press('ArrowDown');
  await expect(choices.first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(people.first()).toBeFocused();
  await expect(people.first()).toHaveValue('glucksmann');

  await second.click();
  await input.fill('Glucksmann');
  await expect(dialog.getByRole('status')).toHaveText(
    'Aucune candidature trouvée',
  );
  await input.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(second).toBeFocused();
  await expect(people.nth(1)).toHaveValue('');

  await second.click();
  await input.fill('le pen');
  await dialog
    .getByRole('button', { name: 'Marine Le Pen', exact: true })
    .click();
  await expect(people.nth(1)).toHaveValue('lepen');
  await expect(page.locator('.comparison-card')).toHaveCount(2);
});
