import { expect, test } from '@playwright/test';

import { chatInput, waitAppReady } from './helpers';

test('both ruby forms render safely', async ({ page }) => {
  await waitAppReady(page);
  const input = chatInput(page);
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
});
