import { expect, Page, test } from '@playwright/test';

import { openPanel, waitAppReady } from './helpers';

/**
 * Draws a picture in the page and hands back its bytes: a flat one as PNG, or a photo-like gradient
 * as JPEG, the kind a phone takes, which a smaller WebP always beats.
 */
async function largePicture(
  page: Page,
  width: number,
  height: number,
  type: 'image/png' | 'image/jpeg'
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ([w, h, kind]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, '#2a6');
      gradient.addColorStop(1, kind === 'image/jpeg' ? '#a26' : '#2a6');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `hsl(${(i * 37) % 360} 70% 50%)`;
        ctx.fillRect((i * 97) % w, (i * 61) % h, 120, 120);
      }
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), kind, 0.9));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (const b of bytes) binary += String.fromCharCode(b);
      return btoa(binary);
    },
    [width, height, type] as const
  );
  return Buffer.from(base64, 'base64');
}

const pictureSources = (page: Page) =>
  page.locator('file-storage img').evaluateAll((els) => els.map((el) => (el as HTMLImageElement).src));

/** Adds one picture through the store's file input and hands back the natural size it was stored at. */
async function addPicture(page: Page, buffer: Buffer, type: string): Promise<{ width: number; height: number }> {
  await page.locator('file-storage input[type="file"][accept="image/*"]').setInputFiles({
    name: type === 'image/jpeg' ? 'large.jpg' : 'large.png',
    mimeType: type,
    buffer,
  });
  const pending = page.locator('file-storage [data-testid="pending-image"]');
  await expect(pending).toBeVisible({ timeout: 10000 });
  // The preview shows the file as chosen, so it is counted among what was there before.
  const before = new Set(await pictureSources(page));
  await pending.getByRole('button', { name: /追加/ }).click();
  await expect(pending).toBeHidden({ timeout: 15000 });
  let added = '';
  await expect
    .poll(
      async () => {
        added = (await pictureSources(page)).find((src) => !before.has(src)) ?? '';
        return added;
      },
      { timeout: 15000 }
    )
    .not.toBe('');
  return page.evaluate(async (src) => {
    const full = new Image();
    full.src = src;
    await full.decode();
    return { width: full.naturalWidth, height: full.naturalHeight };
  }, added);
}

test.describe('大きな画像の縮小', () => {
  test.beforeEach(async ({ page }) => {
    await waitAppReady(page);
    await openPanel(page, '画像');
    await expect(page.locator('file-storage')).toBeVisible({ timeout: 10000 });
  });

  test('既定では長辺2560pxを超える画像を縮小して追加すること', async ({ page }) => {
    await expect(page.getByTestId('file-storage-shrink-large').locator('input')).toBeChecked();
    const photo = await largePicture(page, 4000, 3000, 'image/jpeg');
    expect(photo.length).toBeLessThan(2 * 1024 * 1024);

    expect(await addPicture(page, photo, 'image/jpeg')).toEqual({ width: 2560, height: 1920 });
  });

  test('チェックを外すと元の大きさのまま追加すること', async ({ page }) => {
    await page.getByTestId('file-storage-shrink-large').locator('input').uncheck();
    const photo = await largePicture(page, 3000, 1000, 'image/jpeg');

    expect(await addPicture(page, photo, 'image/jpeg')).toEqual({ width: 3000, height: 1000 });
  });
});
