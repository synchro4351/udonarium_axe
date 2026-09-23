import { expect, test } from '@playwright/test';

import { createCharacter, waitAppReady } from './helpers';

for (const chatFocused of [false, true]) {
  test(`the first character drag works with chat focus ${chatFocused}`, async ({ page }) => {
    await waitAppReady(page);
    await createCharacter(page);

    const piece = page.locator('game-character').filter({ hasText: '新しいキャラクター' }).first();
    const grab = piece.locator('[data-testid="multi-angle-piece-motion-source"]');
    const input = page.locator('textarea[name="chat-input-text"]');
    if (chatFocused) {
      await input.focus();
      await expect(input).toBeFocused();
    }

    const before = await grab.boundingBox();
    expect(before).not.toBeNull();
    const x = before!.x + before!.width / 2;
    const y = before!.y + before!.height / 2;
    await page.mouse.move(x, y);
    if (chatFocused) await expect(input).toBeFocused();
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 50, { steps: 8 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await grab.boundingBox();
        return after ? Math.hypot(after.x - before!.x, after.y - before!.y) : 0;
      })
      .toBeGreaterThan(30);
  });
}
