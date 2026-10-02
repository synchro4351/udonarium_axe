import { expect, Page, test } from '@playwright/test';

import { openPanel, waitAppReady } from './helpers';

async function openParts(page: Page) {
  await waitAppReady(page);
  await openPanel(page, '画像');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#38bdf8';
    context.fillRect(20, 20, 80, 60);
    context.fillStyle = '#fbbf24';
    context.fillRect(140, 50, 120, 120);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const files = page.locator('file-storage');
  await files
    .locator('input[type="file"][accept="image/*"]')
    .setInputFiles({ name: 'parts-test.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const pending = files.getByTestId('pending-image');
  await pending.getByRole('button', { name: /追加/ }).click();
  await expect(pending).toBeHidden();
  await files.locator('img[alt="parts-test.png"]').click();
  await files.getByTestId('multipart-open').click();
  await expect(page.getByTestId('multipart-select')).toBeVisible();
}

async function selectPart(page: Page, start: [number, number], end: [number, number]) {
  const bounds = (await page.getByTestId('multipart-select').boundingBox())!;
  await page.mouse.move(bounds.x + start[0] * bounds.width, bounds.y + start[1] * bounds.height);
  await page.mouse.down();
  await page.mouse.move(bounds.x + end[0] * bounds.width, bounds.y + end[1] * bounds.height, { steps: 8 });
  await page.mouse.up();
}

test('creates two independently named ordinary tokens from selected regions', async ({ page }) => {
  await openParts(page);
  const panel = page.locator('multipart-character');
  await selectPart(page, [0.05, 0.05], [0.38, 0.45]);
  await selectPart(page, [0.9, 0.9], [0.42, 0.2]);
  await expect(panel.locator('input')).toHaveCount(2);
  await panel.locator('input').nth(0).fill('テスト頭部');
  await panel.locator('input').nth(1).fill('テスト胴体');
  const before = await page.locator('game-character').count();
  await panel.getByTestId('multipart-create').click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('game-character')).toHaveCount(before + 2);
  await expect(page.locator('game-character').filter({ hasText: 'テスト頭部' })).toHaveCount(1);
  await expect(page.locator('game-character').filter({ hasText: 'テスト胴体' })).toHaveCount(1);
  await expect(page.locator('file-storage img[alt="parts-test.png"]')).toHaveCount(1);
  await page
    .locator('file-storage label')
    .filter({ hasText: /^全て$/ })
    .click();
  const cropped = page.locator('file-storage img[alt="テスト頭部.png"]');
  await expect(cropped).toHaveCount(1);
  const pixels = await cropped.evaluate(async (element) => {
    const image = element as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return {
      corner: context.getImageData(0, 0, 1, 1).data[3],
      centre: [...context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data],
    };
  });
  expect(pixels.corner).toBe(0);
  expect(pixels.centre[3]).toBe(255);
  expect(pixels.centre[2]).toBeGreaterThan(pixels.centre[0]);
});

test('cancel and remove never create tokens', async ({ page }) => {
  await openParts(page);
  const panel = page.locator('multipart-character');
  const before = await page.locator('game-character').count();
  await selectPart(page, [0.1, 0.1], [0.4, 0.6]);
  await panel.getByRole('button', { name: 'この部位を消す' }).click();
  await expect(panel.getByTestId('multipart-create')).toBeDisabled();
  await selectPart(page, [0.1, 0.1], [0.4, 0.6]);
  await panel.getByRole('button', { name: 'やめる', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('game-character')).toHaveCount(before);
});
