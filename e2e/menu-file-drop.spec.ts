import { expect, Page, test } from '@playwright/test';

import { waitAppReady } from './helpers';

/** Drops a file on the page as a file manager would, by name and text. */
async function dropFile(page: Page, name: string, text: string) {
  await page.evaluate(
    ([fileName, contents]) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([contents], fileName, { type: 'application/json' }));
      for (const type of ['dragenter', 'dragover', 'drop']) {
        document.body.dispatchEvent(new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }));
      }
    },
    [name, text]
  );
}

test('takes an arrangement of the menus dropped on the page, and leaves any other JSON alone', async ({ page }) => {
  await waitAppReady(page);
  const owned = page.locator('app-pl-toolbar [title="所有キャラクター一覧"]');
  await expect(owned).toBeVisible({ timeout: 10000 });

  await dropFile(page, 'notes.json', JSON.stringify({ hello: 'world' }));
  await page.waitForTimeout(500);
  await expect(page.getByTestId('snackbar')).toHaveCount(0);
  await expect(owned).toBeVisible();

  const file = { axeMenus: 1, layouts: { plToolbar: [{ id: 'inventory', command: 'inventory' }] } };
  await dropFile(page, 'axe-menus.json', JSON.stringify(file));
  await expect(page.getByTestId('snackbar')).toContainText('メニューの配置を読み込みました', { timeout: 5000 });
  await expect(owned).toHaveCount(0);
});
