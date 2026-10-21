import { expect, Page, test } from '@playwright/test';

import { waitAppReady } from './helpers';

async function becomeGm(page: Page) {
  await page
    .locator('ui-panel')
    .filter({ hasText: '接続情報' })
    .getByRole('button', { name: /^\s*GM\s*$/ })
    .click();
  await expect(page.locator('app-gm-toolbar button').first()).toBeVisible({ timeout: 10000 });
}

async function selectPart(page: Page, start: [number, number], end: [number, number]) {
  const newRange = page.getByTestId('multipart-new-range');
  if (await newRange.isVisible()) {
    await newRange.click();
    await expect(newRange).toBeHidden();
  }
  const previousCount = await page.getByTestId('multipart-region').count();
  await page.getByTestId('multipart-select').scrollIntoViewIfNeeded();
  await page.getByTestId('multipart-select').evaluate(
    (element) =>
      new Promise<void>((resolve, reject) => {
        let previous = element.getBoundingClientRect();
        let stableFrames = 0;
        let frames = 0;
        const sample = () => {
          const current = element.getBoundingClientRect();
          const stable =
            Math.abs(current.x - previous.x) < 0.25 &&
            Math.abs(current.y - previous.y) < 0.25 &&
            Math.abs(current.width - previous.width) < 0.25 &&
            Math.abs(current.height - previous.height) < 0.25;
          stableFrames = stable ? stableFrames + 1 : 0;
          previous = current;
          frames++;
          if (stableFrames >= 3) resolve();
          else if (frames >= 120) reject(new Error('Multipart image did not settle before pointer input'));
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      })
  );
  const bounds = (await page.getByTestId('multipart-select').boundingBox())!;
  await page.mouse.move(bounds.x + start[0] * bounds.width, bounds.y + start[1] * bounds.height);
  await page.mouse.down();
  await page.mouse.move(bounds.x + end[0] * bounds.width, bounds.y + end[1] * bounds.height, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('multipart-region')).toHaveCount(previousCount + 1);
  await expect(newRange).toBeVisible();
}

/** Splits モンスターC into a linked 頭部 and 胴体, as the multipart tests do. */
async function splitMonster(page: Page) {
  const original = page.locator('game-character').filter({ hasText: 'モンスターC' }).first();
  await original.dispatchEvent('contextmenu');
  await page.locator('context-menu').getByText('部位に分ける', { exact: true }).click();
  const panel = page.locator('multipart-character');
  await expect(panel.getByTestId('multipart-select')).toBeVisible();
  await selectPart(page, [0.02, 0.02], [0.48, 0.98]);
  await selectPart(page, [0.52, 0.02], [0.98, 0.98]);
  await panel.getByRole('textbox', { name: '部位名', exact: true }).nth(0).fill('頭部');
  await panel.getByRole('textbox', { name: '部位名', exact: true }).nth(1).fill('胴体');
  await panel.getByTestId('multipart-create').click();
  await expect(panel).toHaveCount(0);
}

async function chooseSpeaker(page: Page, name: string) {
  const from = page.locator('chat-window .chat-select--from');
  const search = from.locator('input[role="combobox"]');
  await search.fill(name);
  await expect(page.locator('.ng-dropdown-panel').getByRole('option', { name, exact: true })).toBeVisible();
  await search.press('Enter');
  await expect(from.locator('.ng-value-label')).toHaveText(name);
}

async function say(page: Page, line: string) {
  const textarea = page.locator('textarea.chat-input');
  await textarea.fill(line);
  await textarea.press('Enter');
  await expect(textarea).toHaveValue('');
  await expect(page.locator('chat-window chat-message').last()).toContainText(line);
}

test('speaks for a creature of linked parts as a whole, or as one part, which then stays in the list', async ({
  page,
}) => {
  await waitAppReady(page);
  await becomeGm(page);
  await splitMonster(page);

  const from = page.locator('chat-window .chat-select--from');
  await from.locator('input[role="combobox"]').fill('モンスターC');
  const options = page.locator('.ng-dropdown-panel').getByRole('option');
  // One line for the whole creature, none yet for its parts.
  await expect(options.filter({ hasText: /^モンスターC$/ })).toHaveCount(1);
  await expect(options.filter({ hasText: 'モンスターC(' })).toHaveCount(0);
  await from.locator('input[role="combobox"]').press('Escape');

  await chooseSpeaker(page, 'モンスターC');
  await say(page, 'ガオー');
  await expect(page.locator('chat-window chat-message').last()).toContainText('モンスターC');
  await expect(page.locator('chat-window chat-message').last()).not.toContainText('モンスターC(');

  const part = page.getByTestId('chat-input-speaker-part');
  await expect(part).toBeVisible();
  await part.selectOption({ label: '頭部' });
  await expect(from.locator('.ng-value-label')).toHaveText('モンスターC(頭部)');
  await say(page, 'ガブリ');
  await expect(page.locator('chat-window chat-message').last()).toContainText('モンスターC(頭部)');

  // The part spoken as stays beside its creature.
  await from.locator('input[role="combobox"]').fill('モンスターC');
  await expect(options.filter({ hasText: /^モンスターC\(頭部\)$/ })).toHaveCount(1);
  await expect(options.filter({ hasText: /^モンスターC\(胴体\)$/ })).toHaveCount(0);
});
