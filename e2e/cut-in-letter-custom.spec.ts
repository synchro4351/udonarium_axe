import { expect, test } from '@playwright/test';

import { openPanel, waitAppReady } from './helpers';

test('brings each letter of a cut-in in from a pose of the layer’s own, blurred and turned', async ({ page }) => {
  await waitAppReady(page);
  await openPanel(page, 'カットイン');
  const list = page.locator('app-cut-in-list');
  await expect(list).toBeVisible({ timeout: 10000 });
  await list.locator('button[title="新しいカットインを作る"]').click();
  await expect(list.locator('cut-in-editor')).toBeVisible({ timeout: 5000 });

  await list.getByRole('tab', { name: 'シーン' }).click();
  await list.locator('cut-in-scene-editor button', { hasText: '文字を足す' }).click();
  const text = list.locator('cut-in-layer-properties textarea[name="cut-in-layer-text"]');
  await text.fill('ABC');
  await list.getByTestId('cut-in-letter-details').locator('summary').click();
  await list.getByTestId('cut-in-letter-motion').selectOption({ label: 'カスタム' });
  // Settings only a custom motion reads open once it is chosen.
  await expect(list.getByTestId('cut-in-letterFromBlur')).toBeEnabled();
  await list.getByTestId('cut-in-letterFromX').fill('3');
  await list.getByTestId('cut-in-letterFromRotate').fill('90');
  await list.getByTestId('cut-in-letterFromBlur').fill('6');
  await list.getByTestId('cut-in-letterEase').selectOption({ label: '等速' });
  await list.getByTestId('cut-in-letterDurationMs').fill('2000');
  await list.getByTestId('cut-in-letterExit').selectOption({ label: '来た道を戻る' });
  await list.locator('cut-in-scene-editor input[name="cut-in-scene-loop"]').check();

  await list.getByRole('tab', { name: '基本設定' }).click();
  await list.locator('cut-in-editor button[title="自分だけ再生"]').click();

  const letter = page.locator('app-cut-in-window app-cut-in-stage [data-letter-rank="0"]');
  await expect(letter).toBeAttached({ timeout: 5000 });
  const first = await letter.evaluate((element) => {
    const [animation] = element.getAnimations();
    const frames = animation.effect!.getKeyframes();
    const entering = frames.find((frame) => typeof frame['filter'] === 'string' && frame['filter'] !== 'blur(0px)');
    return { filter: entering?.['filter'], transform: entering?.['transform'], count: frames.length };
  });
  expect(first.count).toBeGreaterThan(2);
  expect(first.filter).toMatch(/^blur\(/);
  // Three letters off across, turned: the letter is 32px, so it starts well to the side.
  expect(first.transform).toMatch(/translate\((\d+(\.\d+)?)px/);
  expect(first.transform).toContain('rotate(');
});
