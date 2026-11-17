import { expect, Page, test } from '@playwright/test';

import { openTableContextMenu, revealMenuEntry, waitAppReady } from './helpers';

async function createSquareRange(page: Page, as: 'ダイヤとして出力' | '四角形として出力') {
  const menu = await openTableContextMenu(page);
  await (await revealMenuEntry(page, menu, '射程範囲を作成')).hover();
  await menu.getByText('四角形・ダイヤ', { exact: true }).hover();
  await expect(menu.getByText(as, { exact: true })).toBeVisible({ timeout: 5000 });
  await menu.getByText(as, { exact: true }).click();
  await expect(page.locator('range').first()).toBeAttached({ timeout: 10000 });
}

test.describe('square and diamond ranges', () => {
  test.beforeEach(async ({ page }) => {
    await waitAppReady(page);
  });

  test('snaps to every 45° while Alt is held during a turn, and shows the angle and help while turning', async ({
    page,
  }) => {
    await createSquareRange(page, '四角形として出力');
    const range = page.locator('range').first();
    // The range turns about its own point, which is where the page draws that point of the floor.
    const [x, y, z] = (await range.locator('[data-location]').first().getAttribute('data-location'))!
      .split(',')
      .map(Number);
    const centre = await page.evaluate(([x, y, z]) => window.__axeTable.surfacePageOf('floor', x, y, z)!, [x, y, z]);
    const grab = range.locator('.rotate-grab').first();
    // Over a table drawn on a canvas the handle is put once the canvas draws the range, and takes a
    // press only while the range is pointed at, so the range is pointed at once it is laid out.
    await expect(grab).toBeVisible();
    await page.mouse.move(centre.x, centre.y);
    const box = await grab.boundingBox();
    if (!box) throw new Error('the range is not on screen');
    const cx = centre.x;
    const cy = centre.y;
    const radius = Math.hypot(box.x + box.width / 2 - cx, box.y + box.height / 2 - cy);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const hint = page.getByTestId('rotate-hint');
    for (const degrees of [-80, -70, -60]) {
      const rad = (degrees * Math.PI) / 180;
      await page.mouse.move(cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius, { steps: 3 });
    }
    await expect(hint).toBeVisible();
    await expect(page.getByTestId('rotate-hint-snap')).toContainText('Alt を押しているあいだ 45° ごとにそろえる');
    const free = Number((await page.getByTestId('rotate-hint-angle').textContent())?.replace('°', ''));
    expect(free % 45).not.toBe(0);

    await page.keyboard.down('Alt');
    await expect(page.getByTestId('rotate-hint-snap')).toContainText('45° ごとにそろえています');
    const snapped = Number((await page.getByTestId('rotate-hint-angle').textContent())?.replace('°', ''));
    expect(snapped % 45).toBe(0);

    await page.mouse.up();
    await page.keyboard.up('Alt');
    await expect(hint).toHaveCount(0);
  });
});

test('lands a range with no caster on a cell or on a crossing, by where it is dropped', async ({ page }) => {
  await waitAppReady(page);
  await createCircleRange(page);
  const range = page.locator('range').first();
  const positionX = async () =>
    range
      .locator('[appmovable]')
      .first()
      .evaluate((el) => {
        const match = /translate(?:3d)?\(\s*(-?[\d.]+)px/.exec((el as HTMLElement).style.transform);
        return match ? Number(match[1]) : NaN;
      });
  const handle = range.locator('.pointer-events-auto').first();
  const seen = new Set<number>();
  const landed: number[] = [];
  for (const distance of [10, 20, 30, 40, 50, 60]) {
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + distance, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const x = await positionX();
    expect(Number.isNaN(x)).toBe(false);
    landed.push(x);
    seen.add(((x % 50) + 50) % 50);
  }
  // Every landing is on a half cell, and both kinds are reached.
  expect([...seen].every((rest) => rest === 0 || rest === 25)).toBe(true);
  expect(seen.size).toBe(2);
});
