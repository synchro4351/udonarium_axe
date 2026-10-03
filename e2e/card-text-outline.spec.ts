import { expect, Page, test } from '@playwright/test';

import { openTableContextMenu, waitAppReady } from './helpers';

// Card editing is GM-only unless the room allows players, and a fresh session starts as a player.
async function becomeGm(page: Page) {
  await page
    .locator('ui-panel')
    .filter({ hasText: '接続情報' })
    .getByRole('button', { name: /^\s*GM\s*$/ })
    .click();
  await expect(page.locator('app-gm-toolbar [title^="暗闇"]')).toBeVisible({ timeout: 10000 });
}

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

async function getTextGeometry(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => {
    const containerRect = element.getBoundingClientRect();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) {
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        rects.push({
          x: rect.x - containerRect.x,
          y: rect.y - containerRect.y,
          width: rect.width,
          height: rect.height,
        });
      }
      range.detach();
    }
    return rects;
  });
}

test('card face text preserves ruby and newlines while toggling its halo', async ({ page }) => {
  await waitAppReady(page);
  await becomeGm(page);
  await createBlankCard(page);
  const sheet = await openCardEditor(page);

  const text =
    '｜長い漢字の文章《ながいかんじのぶんしょう》を折り返して表示するためのテキストです。\n' +
    '二行目にもさらに長い日本語の文章を続けて、明示的な改行と複数行の描画を確認します。';
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
  await expect(renderedText).toHaveCSS('text-shadow', 'none');
  const geometryBefore = await renderedText.boundingBox();
  const textGeometryBefore = await getTextGeometry(renderedText);
  expect(textGeometryBefore.length).toBeGreaterThan(3);
  const fontWeightBefore = await renderedText.evaluate((element) => getComputedStyle(element).fontWeight);
  expect(fontWeightBefore).toBe('700');

  await outlineToggle.check();
  const outlineColor = sheet.getByText('縁取り色').locator('..').locator('input[type="color"]');
  await outlineColor.fill('#ff00aa');

  await expect(outlineToggle).toBeChecked();
  const fontWeightDuring = await renderedText.evaluate((element) => getComputedStyle(element).fontWeight);
  expect(fontWeightDuring).toBe('700');
  const textGeometryDuring = await getTextGeometry(renderedText);
  expect(textGeometryDuring).toEqual(textGeometryBefore);
  await expect(renderedText).toHaveCSS('-webkit-text-stroke-width', '0px');
  const haloStyle = await renderedText.evaluate((element) => {
    const style = getComputedStyle(element);
    return { textShadow: style.textShadow, strokeWidth: style.webkitTextStrokeWidth };
  });
  expect(haloStyle.strokeWidth).toBe('0px');
  expect((haloStyle.textShadow.match(/rgb\(255, 0, 170\)/g) ?? []).length).toBe(8);
  expect(haloStyle.textShadow).not.toBe('none');
  await expect(renderedText.locator('ruby')).toContainText('かんじ');
  await expect(renderedText).toHaveText(/漢字.*二行目/s);

  await outlineToggle.uncheck();
  await expect(outlineToggle).not.toBeChecked();
  await expect(renderedText).toHaveCSS('-webkit-text-stroke-width', '0px');
  await expect(renderedText).toHaveCSS('text-shadow', 'none');
  const geometryAfter = await renderedText.boundingBox();
  const fontWeightAfter = await renderedText.evaluate((element) => getComputedStyle(element).fontWeight);
  const textGeometryAfter = await getTextGeometry(renderedText);
  expect(geometryAfter).toEqual(geometryBefore);
  expect(fontWeightAfter).toBe('700');
  expect(textGeometryAfter).toEqual(textGeometryBefore);
  await expect(renderedText.locator('ruby')).toContainText('かんじ');
  await expect(renderedText).toHaveText(/漢字.*二行目/s);
});

test('card face text renders shared formatted markup, keeps raw text, and hides when face down', async ({ page }) => {
  await waitAppReady(page);
  await becomeGm(page);
  await createBlankCard(page);
  const sheet = await openCardEditor(page);

  const raw = '# Title\n- first item\n> quoted line\n`a<b>`\n｜漢字《かんじ》\n1 < 2 > 0 2*3+4';
  const textInput = sheet.locator('[data-testid="card-face-text"]');
  await textInput.fill(raw);
  await textInput.blur();

  const formatSwitch = sheet.getByRole('radiogroup', { name: '表示形式' });
  await formatSwitch.getByRole('radio', { name: '整形' }).click();
  await expect(formatSwitch.getByRole('radio', { name: '整形' })).toHaveAttribute('aria-checked', 'true');

  const rendered = page.locator('card-face-text').first().locator('span.note-formatted');
  await expect(rendered.locator('h1')).toHaveText('Title');
  await expect(rendered.locator('ul > li')).toHaveText('first item');
  await expect(rendered.locator('blockquote')).toContainText('quoted line');
  await expect(rendered.locator('code').first()).toHaveText('a<b>');
  await expect(rendered.locator('ruby')).toContainText('漢字');
  await expect(rendered.locator('ruby')).toContainText('かんじ');
  await expect(rendered).toContainText('1 < 2 > 0 2*3+4');
  await expect(rendered.locator('em, script, img')).toHaveCount(0);

  await formatSwitch.getByRole('radio', { name: '通常' }).click();
  await expect(formatSwitch.getByRole('radio', { name: '通常' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('card-face-text span.note-formatted')).toHaveCount(0);
  await expect(page.locator('card-face-text').first().locator('h1, ul, blockquote')).toHaveCount(0);
  await expect(textInput).toHaveValue(raw);

  await formatSwitch.getByRole('radio', { name: '整形' }).click();
  await expect(rendered.locator('h1')).toHaveText('Title');

  await page.locator('card').first().dispatchEvent('contextmenu');
  const menu = page.locator('context-menu');
  await expect(menu.locator('li').first()).toBeVisible({ timeout: 5000 });
  await menu.getByText('裏にする', { exact: true }).click();
  await expect(page.locator('card-face-text span')).toHaveCount(0);
  await expect(page.locator('card-face-text').first()).not.toContainText('Title');
});
