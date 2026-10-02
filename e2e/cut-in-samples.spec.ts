import { expect, test } from '@playwright/test';
import { closeFabMenu, openPanel, waitAppReady } from './helpers';

test('keeps the three initial samples and loads the optional example pack', async ({ page }) => {
  await waitAppReady(page);
  await openPanel(page, 'カットイン');
  await closeFabMenu(page);
  const panel = page.locator('app-cut-in-list');
  const entries = panel.locator('aside ul[role="listbox"] > li');
  await expect(entries).toHaveCount(3);
  await entries.filter({ hasText: 'Sample_Template' }).click();
  await panel.getByRole('tab', { name: 'シーン', exact: true }).click();
  await expect(panel.locator('cut-in-portrait-picker')).toBeVisible();
  const pack = panel.getByTestId('cut-in-example-pack');
  const [download] = await Promise.all([page.waitForEvent('download'), pack.click()]);
  const archive = await download.path();
  expect(archive).toBeTruthy();
  await page.getByTestId('fab-zip-input').setInputFiles(archive!);
  await expect(entries).toHaveCount(19);
  await expect(entries.filter({ hasText: 'Sample_Template' })).toBeVisible();
  await expect(entries.filter({ hasText: 'いいね！' })).toBeVisible();
  await entries.filter({ hasText: '参戦！' }).click();
  await expect(panel.locator('cut-in-scene-editor')).toBeVisible();
  await expect(panel.locator('cut-in-layer-list li')).not.toHaveCount(0);
});
