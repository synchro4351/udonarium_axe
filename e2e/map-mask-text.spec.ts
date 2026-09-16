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

  const text =
    'a|漢字《かんじ》d 長い文章でも縁取りの切替で改行位置が変わらないことを確認します。\n二行目も同じ太さで表示します。';
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
  await expect(renderedText).toHaveCSS('text-shadow', 'none');
  await expect(renderedText).toHaveCSS('font-weight', '700');
  const textRects = async () =>
    renderedText.evaluate((element) => {
      const origin = element.getBoundingClientRect();
      const range = document.createRange();
      const textNodes: Text[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent) textNodes.push(node as Text);
      }
      return textNodes.flatMap((textNode) => {
        range.selectNodeContents(textNode);
        return [...range.getClientRects()].map((rect) => [
          rect.x - origin.x,
          rect.y - origin.y,
          rect.width,
          rect.height,
        ]);
      });
    });
  const unoutlinedRects = await textRects();
  expect(unoutlinedRects.length).toBeGreaterThan(3);
  await outlineToggle.check();
  const outlineColor = editor.getByText('縁取り色').locator('..').locator('input[type="color"]');
  await outlineColor.fill('#ff00aa');

  await expect(outlineToggle).toBeChecked();
  await expect(renderedText).toHaveCSS('font-size', '39px');
  await expect(renderedText).toHaveCSS('color', 'rgb(0, 170, 255)');
  await expect(renderedText).toHaveCSS('font-weight', '700');
  const shadow = await renderedText.evaluate((element) => getComputedStyle(element).textShadow);
  expect((shadow.match(/rgb\(255, 0, 170\)/g) ?? []).length).toBe(8);
  await expect(renderedText).toHaveCSS('-webkit-text-stroke-width', '0px');
  expect(await textRects()).toEqual(unoutlinedRects);
  await outlineToggle.uncheck();
  await expect(renderedText).toHaveCSS('text-shadow', 'none');
  await expect(renderedText).toHaveCSS('font-weight', '700');
  expect(await textRects()).toEqual(unoutlinedRects);
  await outlineToggle.check();
  await expect(renderedText.locator('ruby')).toContainText('かんじ');

  await renderedText.screenshot({ path: testInfo.outputPath('map-mask-text.png') });
});
