import { expect, test } from '@playwright/test';

import { openFabMenu, waitAppReady } from './helpers';

test('stamp panel and chat behave in a real browser', async ({ page }) => {
  await waitAppReady(page);

  // The writing tools open the emoji and syntax picker; a press anywhere else puts it away.
  // Sending stamps themselves is covered by chat-stamps.spec on the official stamp picker.
  const tools = page.getByTestId('chat-writing-tools');
  const picker = page.locator('chat-stamp-picker');
  await tools.click();
  await expect(picker).toBeVisible();
  await page.locator('textarea.chat-input').click();
  await expect(picker).toBeHidden();

  // The syntax tab writes into the box and sends nothing.
  await tools.click();
  await picker.getByRole('tab', { name: /特殊記法/ }).click();
  await picker.locator('[data-syntax="ruby"]').click();
  const textarea = page.locator('textarea.chat-input');
  await expect(textarea).toHaveValue('|漢字<かんじ>');

  // A saved word typed without a colon is offered, and only sent when chosen.
  await textarea.fill('ドンマイ');
  await expect(page.getByTestId('chat-stamp-suggestion')).toHaveCount(1);
  await textarea.press('ArrowDown');
  await textarea.press('Enter');
  await expect(textarea).toHaveValue('');
  await expect(page.locator('chat-message [data-testid="chat-message-stamp"]')).toHaveCount(1);

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
