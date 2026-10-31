import { expect, test } from '@playwright/test';

import { closeFabMenu, openPanel, waitAppReady } from './helpers';

test('opens a context menu, and its submenus, from the inventory taken out into a window', async ({ page }) => {
  await waitAppReady(page);
  await openPanel(page, 'インベントリ');
  await closeFabMenu(page);
  const inventory = page.locator('game-object-inventory');
  await expect(inventory.locator('[data-testid="inventory-item"]').first()).toBeVisible({ timeout: 10000 });

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page
      .locator('ui-panel')
      .filter({ has: page.locator('game-object-inventory') })
      .locator('[data-testid="panel-controls"] button[title="別のウィンドウで開く"]')
      .click(),
  ]);
  const item = popup.locator('game-object-inventory [data-testid="inventory-item"]').first();
  await expect(item).toBeVisible({ timeout: 10000 });

  // The pointer goes on about the page before it reaches the window, which on the page alone
  // reads as a press dragged away rather than one to open a menu from.
  await page.mouse.move(400, 300);
  await page.mouse.move(600, 500, { steps: 5 });

  await item.click({ button: 'right' });

  const menu = popup.locator('[data-context-menu-root]').first();
  await expect(menu).toBeVisible({ timeout: 5000 });
  const opener = menu.locator('li').filter({ has: popup.locator('.material-icons', { hasText: 'chevron_right' }) });
  if ((await opener.count()) > 0) {
    await opener.first().hover();
    await expect(popup.locator('[data-context-menu-root]')).toHaveCount(2, { timeout: 5000 });
    const sub = popup.locator('[data-context-menu-root]').nth(1);
    const box = (await sub.boundingBox())!;
    const size = popup.viewportSize() ?? (await popup.evaluate(() => ({ width: innerWidth, height: innerHeight })));
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
  }
});
