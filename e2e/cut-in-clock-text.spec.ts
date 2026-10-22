import { expect, Locator, Page, test } from '@playwright/test';

import { openPanel, waitAppReady } from './helpers';

/**
 * Makes a new cut-in whose looping scene holds one text layer that says `{time} あと{remaining}`,
 * and leaves the editor on its basic tab.
 */
async function makeClockCutIn(page: Page): Promise<Locator> {
  await waitAppReady(page);
  await openPanel(page, 'カットイン');
  const list = page.locator('app-cut-in-list');
  await expect(list).toBeVisible({ timeout: 10000 });
  await list.locator('button[title="新しいカットインを作る"]').click();
  await expect(list.locator('cut-in-editor')).toBeVisible({ timeout: 5000 });

  await list.getByRole('tab', { name: 'シーン' }).click();
  await list.locator('cut-in-scene-editor button', { hasText: '文字を足す' }).click();
  const text = list.locator('cut-in-layer-properties textarea[name="cut-in-layer-text"]');
  await text.fill('');
  await list.getByTestId('cut-in-insert-clock').click();
  await expect(text).toHaveValue('{time}');
  await text.press('End');
  await text.pressSequentially(' あと');
  await list.getByTestId('cut-in-insert-remaining').click();
  await expect(text).toHaveValue('{time} あと{remaining}');
  await list.locator('cut-in-scene-editor input[name="cut-in-scene-loop"]').check();

  await list.getByRole('tab', { name: '基本設定' }).click();
  return list;
}

function stageOf(page: Page): Locator {
  return page.locator('app-cut-in-window app-cut-in-stage');
}

test.describe('a cut-in that tells the time', () => {
  test('shows the time of day and counts down to the duration it was given', async ({ page }) => {
    const list = await makeClockCutIn(page);
    await list.locator('input[name="cut-in-out-time"]').fill('600');
    await list.locator('cut-in-editor button[title="自分だけ再生"]').click();

    const stage = stageOf(page);
    await expect(stage).toBeVisible({ timeout: 5000 });
    await expect(stage).toHaveText(/^\d{2}:\d{2} あと(10:00|9:5\d)$/);
    // A few seconds on, the time left has moved down.
    await expect(stage).toHaveText(/^\d{2}:\d{2} あと9:(5[0-6]|4\d)$/, { timeout: 8000 });
  });

  test('shows no time left for a cut-in that runs until it is stopped', async ({ page }) => {
    const list = await makeClockCutIn(page);
    await list.locator('cut-in-editor button[title="自分だけ再生"]').click();

    const stage = stageOf(page);
    await expect(stage).toBeVisible({ timeout: 5000 });
    await expect(stage).toHaveText(/^\d{2}:\d{2} あと--:--$/);
  });
});

test('counts the seconds since the cut-in came on, padded to the digits asked for', async ({ page }) => {
  await waitAppReady(page);
  await openPanel(page, 'カットイン');
  const list = page.locator('app-cut-in-list');
  await expect(list).toBeVisible({ timeout: 10000 });
  await list.locator('button[title="新しいカットインを作る"]').click();
  await list.getByRole('tab', { name: 'シーン' }).click();
  await list.locator('cut-in-scene-editor button', { hasText: '文字を足す' }).click();
  const text = list.locator('cut-in-layer-properties textarea[name="cut-in-layer-text"]');
  await text.fill('');
  await list.getByTestId('cut-in-insert-elapsed').click();
  await expect(text).toHaveValue('{elapsed}');
  await text.fill('経過 {elapsed:3} 秒');
  await list.locator('cut-in-scene-editor input[name="cut-in-scene-loop"]').check();
  await list.getByRole('tab', { name: '基本設定' }).click();
  await list.locator('cut-in-editor button[title="自分だけ再生"]').click();

  const stage = stageOf(page);
  await expect(stage).toBeVisible({ timeout: 5000 });
  await expect(stage).toHaveText(/^経過 00[0-2] 秒$/);
  await expect(stage).toHaveText(/^経過 00[2-6] 秒$/, { timeout: 8000 });
});
