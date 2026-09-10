import { expect, Page, test, TestInfo } from '@playwright/test';

import { openTableContextMenu, waitAppReady } from './helpers';

async function createMapMask(page: Page) {
  const menu = await openTableContextMenu(page);
  await menu.getByText('マップマスクを作成').click();
  await expect(page.locator('game-table-mask').first()).toBeAttached({ timeout: 10000 });
}

async function openMaskEditor(page: Page) {
  await page.locator('game-table-mask').first().dispatchEvent('contextmenu');
  const menu = page.locator('context-menu');
  await expect(menu.locator('li').first()).toBeVisible({ timeout: 5000 });
  await menu.getByText('マスクを編集').click();
  const sheet = page.locator('game-character-sheet');
  await expect(sheet).toBeVisible({ timeout: 10000 });
  return sheet;
}

test('map mask text preserves styling and legacy masks stay unlabeled', async ({ page }, testInfo: TestInfo) => {
  await waitAppReady(page);
  await createMapMask(page);
  const sheet = await openMaskEditor(page);

  const text = 'a|漢字《かんじ》d\n二行目';
  const textInput = sheet.locator('[data-map-mask-text-editor] textarea');
  await textInput.fill(text);
  await textInput.blur();

  const mask = page.locator('game-table-mask').first();
  const renderedText = mask.locator('div.z-1').first();
  await expect(renderedText).toBeVisible();
  await expect(renderedText.locator('ruby')).toContainText('漢字');
  await expect(renderedText).toHaveText(/漢字.*二行目/s);

  const fontSize = sheet.getByText('文字サイズ').locator('..').locator('input[type="number"]');
  await fontSize.fill('30');
  await fontSize.blur();
  const fontColor = sheet.getByText('文字色').locator('..').locator('input[type="color"]');
  await fontColor.fill('#00aaff');
  const backgroundColor = sheet.getByText('背景色').locator('..').locator('input[type="color"]');
  await backgroundColor.fill('#112233');

  const editor = sheet.locator('[data-map-mask-text-editor]');
  const outlineToggle = editor.locator('input[type="checkbox"]');
  await expect(outlineToggle).not.toBeChecked();
  await expect(renderedText).toHaveCSS('-webkit-text-stroke', /0px/);
  await outlineToggle.check();
  const outlineColor = editor.getByText('縁取り色').locator('..').locator('input[type="color"]');
  await outlineColor.fill('#ff00aa');

  await expect(outlineToggle).toBeChecked();
  await expect(renderedText).toHaveCSS('font-size', '39px');
  await expect(renderedText).toHaveCSS('color', 'rgb(0, 170, 255)');
  await expect(renderedText).toHaveCSS('-webkit-text-stroke-width', '2.925px');
  await expect(renderedText).toHaveCSS('-webkit-text-stroke-color', 'rgb(255, 0, 170)');
  await expect(renderedText.locator('ruby')).toContainText('かんじ');

  await renderedText.screenshot({ path: testInfo.outputPath('map-mask-text.png') });
});
