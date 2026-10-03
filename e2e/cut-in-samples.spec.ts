import { expect, test } from '@playwright/test';
import { closeFabMenu, openPanel, waitAppReady } from './helpers';

test('keeps the three initial samples and offers no optional example library', async ({ page }) => {
  await waitAppReady(page);
  await openPanel(page, 'カットイン');
  await closeFabMenu(page);
  const panel = page.locator('app-cut-in-list');
  const entries = panel.locator('aside ul[role="listbox"] > li');
  await expect(entries).toHaveCount(3);
  await entries.filter({ hasText: 'Sample_Template' }).click();
  await panel.getByRole('tab', { name: 'シーン', exact: true }).click();
  await expect(panel.locator('cut-in-portrait-picker')).toBeVisible();
  await expect(panel.getByTestId('cut-in-scene-template')).toHaveCount(0);
  await expect(panel.getByTestId('cut-in-example-pack')).toHaveCount(0);
});
