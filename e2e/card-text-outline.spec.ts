import { expect, Page, test, TestInfo } from '@playwright/test';

import { openTableContextMenu, waitAppReady } from './helpers';

async function createBlankCard(page: Page) {
  const menu = await openTableContextMenu(page);
  await menu.getByText('ブランクカードを作成').click();
  await expect(page.locator('card').first()).toBeAttached({ timeout: 10000 });
}

async function openCardEditor(page: Page) {
  await page.locator('card').first().dispatchEvent('contextmenu');
  const menu = page.locator('context-menu');
  await expect(menu.locator('li').first()).toBeVisible({ timeout: 5000 });
  await menu.getByText('カードを編集').click();
  const sheet = page.locator('game-character-sheet');
  await expect(sheet).toBeVisible({ timeout: 10000 });
  return sheet;
}

test('card face text preserves ruby and newlines while toggling its outline', async ({ page }, testInfo: TestInfo) => {
  await waitAppReady(page);
  await createBlankCard(page);
  const sheet = await openCardEditor(page);

  const text = '｜漢字《かんじ》\n二行目';
  const textInput = sheet.locator('textarea').first();
  await textInput.fill(text);
  await textInput.blur();

  const faceText = page.locator('card-face-text').first();
  const renderedText = faceText.locator('div').first();
  await expect(renderedText).toBeVisible();
  await expect(renderedText.locator('ruby')).toContainText('漢字');
  await expect(renderedText).toContainText('二行目');
  await expect(renderedText).toHaveText(/漢字.*二行目/s);

  const outlineToggle = sheet.getByText('文字の縁取り').locator('..').locator('input[type="checkbox"]');
  await expect(outlineToggle).not.toBeChecked();
  await expect(renderedText).toHaveCSS('-webkit-text-stroke-width', '0px');

  await outlineToggle.check();
  const outlineColor = sheet.getByText('縁取り色').locator('..').locator('input[type="color"]');
  await outlineColor.fill('#ff00aa');

  await expect(outlineToggle).toBeChecked();
  await expect(renderedText).toHaveCSS('-webkit-text-stroke-width', /^(?!0px$).+/);
  await expect(renderedText).toHaveCSS('-webkit-text-stroke-color', 'rgb(255, 0, 170)');
  await expect(renderedText.locator('ruby')).toContainText('かんじ');
  await expect(renderedText).toHaveText(/漢字.*二行目/s);
  await page.screenshot({ path: testInfo.outputPath('card-text-outline.png'), fullPage: false });
});
