import { expect, Locator, Page, test } from '@playwright/test';

import { waitAppReady } from './helpers';
import { settle } from './see-through-helpers';

/** Opens the piece's menu and walks into 表示と扱い › 画像効果, then presses `entry`. */
async function chooseEffect(page: Page, piece: Locator, path: string[]) {
  await piece.dispatchEvent('contextmenu');
  const menu = page.locator('context-menu');
  await expect(menu.locator('li').first()).toBeVisible({ timeout: 5000 });
  const steps = ['表示と扱い', '画像効果', ...path];
  for (const step of steps.slice(0, -1)) await menu.getByText(step, { exact: true }).first().hover();
  await menu
    .getByText(new RegExp(`^(✔ )?${steps.at(-1)}$`))
    .first()
    .click();
  await expect(page.locator('context-menu')).toHaveCount(0, { timeout: 5000 });
  await page.mouse.move(5, 400);
}

test('lays effects over a piece picture from its menu, without moving the picture out of its stand', async ({
  page,
}) => {
  await waitAppReady(page);
  const piece = page.locator('game-character').filter({ hasText: 'キャラクターA' }).first();
  const picture = piece.locator('img[appSeeThrough], img.image').first();
  await expect(picture).toBeVisible();
  // The view is still settling just after start-up.
  await settle(piece);
  const before = await picture.boundingBox();

  await chooseEffect(page, piece, ['左右反転']);
  await chooseEffect(page, piece, ['揺らす']);
  await chooseEffect(page, piece, ['オーラ', '赤']);

  // Mirrored inside the turn to the camera, last of all.
  await expect.poll(() => picture.evaluate((img) => img.style.transform)).toMatch(/scaleX\(-1\)$/);
  const style = await picture.evaluate((img) => {
    const css = getComputedStyle(img);
    return { filter: css.filter, animation: css.animationName };
  });
  expect(style.filter).toContain('drop-shadow');
  expect(style.animation).toBe('imageEffectShake');
  // Turned the other way round in place: the picture still stands where it stood.
  const after = (await picture.boundingBox())!;
  expect(Math.abs(after.x + after.width / 2 - (before!.x + before!.width / 2))).toBeLessThan(8);
  expect(Math.abs(after.y - before!.y)).toBeLessThan(8);
  await page.screenshot({ path: test.info().outputPath('effects.png') });

  await chooseEffect(page, piece, ['効果をすべて外す']);
  await expect.poll(() => picture.evaluate((img) => img.style.transform)).not.toContain('scaleX(-1)');
});
