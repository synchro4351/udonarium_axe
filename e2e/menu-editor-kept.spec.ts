import { expect, test } from '@playwright/test';

import { closeFabMenu, openSeatDisplay, waitAppReady } from './helpers';

test('keeps the menu editor on the drawer, so the menus can always be arranged again', async ({ page }) => {
  await waitAppReady(page);
  const display = await openSeatDisplay(page);
  await display.getByTestId('fab-entry-menuEditor').click();
  await closeFabMenu(page);

  const editor = page.locator('app-menu-editor-panel');
  await expect(editor).toBeVisible({ timeout: 10000 });
  await expect(editor.getByTestId('menu-editor-remove-menuEditor')).toBeDisabled();
  await expect(editor.getByTestId('menu-editor-remove-display')).toBeDisabled();
  await expect(editor.getByTestId('menu-editor-remove-chat')).toBeEnabled();
});
