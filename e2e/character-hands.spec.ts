import { expect, Page, test } from '@playwright/test';

import { openPanel, openTableContextMenu, revealMenuEntry, waitAppReady } from './helpers';

async function openCardStackMenu(page: Page) {
  await page.locator('card-stack').first().dispatchEvent('contextmenu');
  const menu = page.locator('context-menu');
  await expect(menu.locator('li').first()).toBeVisible({ timeout: 5000 });
  return menu;
}

test("gives the top card of a stack into a character's hand, listed among everyone's hands as the character's", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('ui-lang', 'ja'));
  await waitAppReady(page);
  const tableMenu = await openTableContextMenu(page);
  await (await revealMenuEntry(page, tableMenu, 'トランプの山札を作成')).click();
  await expect(page.locator('card-stack').first()).toBeAttached({ timeout: 10000 });
  const menu = await openCardStackMenu(page);
  const give = menu.locator('li', { hasText: '一番上のカードを渡す' });
  await give.scrollIntoViewIfNeeded();
  await give.click();
  const recipients = page.locator('[data-context-menu-root]').nth(1);
  await recipients.locator('li', { hasText: 'モンスターA' }).first().click();

  await openPanel(page, '手札');
  await page.locator('app-hand-rail [data-testid="hand-overview-open"]').click();
  const section = page
    .locator('hand-overview-panel [data-testid="hand-overview-section"]')
    .filter({ hasText: 'モンスターA' });
  await expect(section).toBeVisible({ timeout: 5000 });
  await expect(section.locator('[data-testid="hand-overview-character"]')).toBeVisible();
  await expect(section).toContainText('1');
});
