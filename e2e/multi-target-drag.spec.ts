import { expect, test } from '@playwright/test';

import { closeFabMenu, waitAppReady } from './helpers';

test('aims at every piece inside a box drawn with Alt held, without long-pressing', async ({ page }) => {
  await waitAppReady(page);
  await closeFabMenu(page);
  // The panels that open at first lie over the pieces; a drag over them would land on a panel.
  const closers = page.locator('ui-panel button').filter({ hasText: /^\s*close\s*$/ });
  while ((await closers.count()) > 0) {
    const before = await page.locator('ui-panel').count();
    await closers.first().dispatchEvent('click');
    await expect(page.locator('ui-panel')).toHaveCount(before - 1, { timeout: 5000 });
  }
  const pictures = ['モンスターA', 'モンスターB'].map((name) =>
    page.locator('game-character').filter({ hasText: name }).first().locator('img').first()
  );
  for (const picture of pictures) await expect(picture).toBeVisible({ timeout: 10000 });
  const boxes = (await Promise.all(pictures.map((picture) => picture.boundingBox()))).filter(
    (box): box is NonNullable<typeof box> => box !== null
  );
  const left = Math.min(...boxes.map((box) => box.x)) - 80;
  const top = Math.min(...boxes.map((box) => box.y)) - 80;
  const right = Math.max(...boxes.map((box) => box.x + box.width)) + 80;
  const bottom = Math.max(...boxes.map((box) => box.y + box.height)) + 80;
  await expect(page.locator('[data-testid="target-ring"]')).toHaveCount(0);

  await page.keyboard.down('Alt');
  await page.mouse.move(left, top);
  await page.mouse.down();
  await page.mouse.move(right, bottom, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Alt');

  await expect(page.locator('[data-testid="target-ring"]')).toHaveCount(2, { timeout: 5000 });
});
