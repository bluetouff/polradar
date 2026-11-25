import { expect, type Page } from '@playwright/test';
import { pageSize } from '../../src/lib/pagination';

export async function openDossier(page: Page, selector: string) {
  const directory = page.locator('.dossier-directory');
  if ((await directory.getAttribute('open')) === null) {
    await directory.locator('summary').click();
  }
  const card = directory.locator(selector);
  await expect(card).toHaveCount(1);
  const all = directory.locator('.subject-card');
  const pager = directory.locator('[data-pager]').first();
  if ((await all.count()) > pageSize) await expect(pager).toBeVisible();
  const index = await all.evaluateAll(
    (links, target) => links.findIndex((link) => link.matches(target)),
    selector,
  );
  if (!(await card.isVisible())) {
    const number = Math.floor(index / pageSize) + 1;
    await pager.locator(`a[data-page="${number}"]`).first().click();
  }
  await card.click();
}
