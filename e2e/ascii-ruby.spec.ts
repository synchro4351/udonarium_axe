import { expect, test } from '@playwright/test';

import { waitAppReady } from './helpers';

test('both ruby forms render safely and the picker inserts ASCII notation', async ({ page }) => {
  await waitAppReady(page);
  const input = page.locator('textarea.chat-input');
  await input.fill('「|魔法<まほう>を使う！」 と ｜技《わざ》');
  await input.press('Enter');
  const message = page.locator('chat-message').last();
  await expect(message.locator('ruby rt')).toHaveText(['まほう', 'わざ']);
  await expect(message.locator('ruby rb')).toHaveText(['魔法', '技']);
  await input.fill('1 < 2 > 0 と |名前<img src=x onerror=alert(1)>');
  await input.press('Enter');
  const literal = page.locator('chat-message').last();
  await expect(literal).toContainText('1 < 2 > 0');
  await expect(literal.locator('ruby rt')).toHaveText('img src=x onerror=alert(1)');
  await expect(literal.locator('ruby img, script')).toHaveCount(0);
  await page.getByTestId('chat-stamp-button').click();
  const picker = page.locator('chat-stamp-picker');
  await picker.getByRole('tab', { name: /特殊記法/ }).click();
  await picker.locator('[data-syntax="ruby"]').click();
  await expect(input).toHaveValue('|漢字<かんじ>');
});
