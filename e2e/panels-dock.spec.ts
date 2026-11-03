import { expect, Locator, Page, test } from '@playwright/test';

import { closeFabMenu, openPanel, waitAppReady } from './helpers';

/** The title bar of a panel, which is what a panel is dragged and docked by. */
function barOf(panel: Locator): Locator {
  return panel.locator('.bg-ui-titlebar').first();
}

function frameOf(panel: Locator): Locator {
  return panel.locator('.draggable-panel').first();
}

/** Where a bar has come to rest, once the panel has finished flying in. */
async function restingBox(bar: Locator) {
  await bar.evaluate((element) => {
    const panel = element.closest('.draggable-panel') ?? element;
    const ending = panel
      .getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
    return Promise.all(ending.map((animation) => animation.finished.catch(() => undefined)));
  });
  const box = await bar.boundingBox();
  if (!box) throw new Error('the bar is not on screen');
  return box;
}

/** Drags a panel by its bar to a point, checking the preview shows before it is let go of. */
async function dragBarTo(page: Page, panel: Locator, x: number, y: number) {
  await closeFabMenu(page);
  const grip = await restingBox(barOf(panel));
  await page.mouse.move(grip.x + 40, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 16 });
  await expect(page.getByTestId('panel-dock-preview')).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId('panel-dock-preview')).toHaveCount(0);
}

test.describe('docking panels against the sides of the screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await waitAppReady(page);
    await page
      .locator('ui-panel', { has: page.locator('peer-menu') })
      .locator('.bg-ui-titlebar button', { hasText: 'close' })
      .dispatchEvent('click');
    await closeFabMenu(page);
  });

  test('docks to the full height, stacks a second, folds a third in as a tab, and undocks', async ({ page }) => {
    // Each panel is opened just before it is docked, so none covers the menu the next is opened from.
    await openPanel(page, 'テーブル設定');
    const table = page.locator('ui-panel', { has: page.locator('game-table-setting') });
    const images = page.locator('ui-panel', { has: page.locator('file-storage') });
    const inventory = page.locator('ui-panel', { has: page.locator('game-object-inventory') });

    await dragBarTo(page, table, 1278, 400);
    const docked = await frameOf(table).boundingBox();
    expect(docked).not.toBeNull();
    expect(Math.round(docked!.x + docked!.width)).toBe(1280);
    expect(Math.round(docked!.y)).toBe(0);
    expect(Math.round(docked!.height)).toBe(800);

    await openPanel(page, '画像');
    await dragBarTo(page, images, 1278, 700);
    const upper = await frameOf(table).boundingBox();
    const lower = await frameOf(images).boundingBox();
    expect(Math.round(upper!.height)).toBe(400);
    expect(Math.round(lower!.y)).toBe(400);
    expect(Math.round(lower!.x + lower!.width)).toBe(1280);

    await openPanel(page, 'インベントリ');
    await dragBarTo(page, inventory, 1278, 700);
    const gathered = page.locator('ui-panel', { has: page.locator('file-storage') });
    await expect(gathered.locator('game-object-inventory')).toHaveCount(1);
    await expect(gathered.getByRole('tab')).toHaveCount(2);

    // Pulled off its side, the upper one stands free again and the lower one takes the height.
    await closeFabMenu(page);
    const grip = await restingBox(barOf(table));
    await page.mouse.move(grip.x + 40, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(640, 300, { steps: 16 });
    await page.mouse.up();
    const freed = await frameOf(table).boundingBox();
    expect(Math.round(freed!.height)).toBeLessThan(800);
    await expect.poll(async () => Math.round((await frameOf(gathered).boundingBox())!.height)).toBe(800);
  });
});
