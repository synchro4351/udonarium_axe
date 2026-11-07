import { expect, test } from '@playwright/test';

import { chatInput, openFabMenu, waitAppReady } from './helpers';

test('stamp panel and chat behave in a real browser', async ({ page }) => {
  await waitAppReady(page);

  // A press anywhere else puts the stamp list away. Sending stamps themselves is covered by
  // chat-stamps.spec.
  const stampButton = page.getByTestId('chat-input-stamp');
  const picker = page.getByTestId('stamp-picker');
  await stampButton.click();
  await expect(picker).toBeVisible();
  const textarea = chatInput(page);
  await textarea.click();
  await expect(picker).toHaveCount(0);

  await textarea.fill('👍🎉');
  await textarea.press('Enter');
  await expect(page.locator('chat-message [data-large-emoji="true"]').last()).toBeVisible();

  await openFabMenu(page);
  await page.getByTestId('fab-entry-media').click();
  await page.getByTestId('fab-entry-stampPacks').click();
  const panel = page.getByTestId('stamp-pack-list');
  await expect(panel.getByTestId('stamp-builtin-item')).toHaveCount(10);
  await panel.getByTestId('stamp-pack-create').click();
  await panel.getByTestId('stamp-add').setInputFiles('src/assets/images/stamps/iine.png');
  await expect(panel.getByTestId('stamp-item')).toHaveCount(1);
  await panel.getByTestId('stamp-item').click();
  await panel.getByTestId('stamp-words').fill('すごい いいね');
  await panel.getByTestId('stamp-words').press('Enter');
  await expect(panel.getByTestId('stamp-item-label')).toHaveText('すごい');
  await panel.getByTestId('stamp-add').setInputFiles('src/assets/images/stamps/matane.png');
  await expect(panel.getByTestId('stamp-item')).toHaveCount(2);
  await panel.getByTestId('stamp-item').first().click();
  await expect(panel.getByTestId('stamp-words')).toHaveValue('すごい いいね');
});
