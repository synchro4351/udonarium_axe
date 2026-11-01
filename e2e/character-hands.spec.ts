import { expect, Page, test } from '@playwright/test';

import { openTableContextMenu, revealMenuEntry, waitAppReady } from './helpers';

async function openCardStackMenu(page: Page) {
  await page.locator('card-stack').first().dispatchEvent('contextmenu');
  const menu = page.locator('context-menu');
  await expect(menu.locator('li').first()).toBeVisible({ timeout: 5000 });
  return menu;
}

test('offers no piece on the table as a hand to give to until it has been given one', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ui-lang', 'ja'));
  await waitAppReady(page);
  const tableMenu = await openTableContextMenu(page);
  await (await revealMenuEntry(page, tableMenu, 'トランプの山札を作成')).click();
  await expect(page.locator('card-stack').first()).toBeAttached({ timeout: 10000 });
  await expect(page.locator('game-character').filter({ hasText: 'モンスターA' }).first()).toBeAttached();

  const menu = await openCardStackMenu(page);
  const give = menu.locator('li', { hasText: '一番上のカードを渡す' });
  if ((await give.count()) > 0) {
    await give.click();
    const recipients = page.locator('[data-context-menu-root]').nth(1);
    await expect(recipients.locator('li', { hasText: 'モンスターA' })).toHaveCount(0);
  }
});
