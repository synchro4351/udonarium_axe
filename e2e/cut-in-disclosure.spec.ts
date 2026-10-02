import { expect, test } from '@playwright/test';
import { openPanel, waitAppReady } from './helpers';

test.describe('cut-in progressive disclosure', () => {
  test.beforeEach(async ({ page }) => {
    await waitAppReady(page);
    await openPanel(page, 'カットイン');
    await page.getByTestId('cut-in-scene-template').selectOption('portrait');
    await expect(page.locator('cut-in-scene-editor')).toBeVisible();
  });

  test('keeps the stage and layer selection available while details are folded', async ({ page }) => {
    const editor = page.locator('cut-in-scene-editor');
    const toggle = editor.getByTestId('cut-in-timeline-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(editor.locator('cut-in-timeline')).toHaveCount(0);
    const rows = editor.getByTestId('cut-in-compact-layers').locator('li');
    expect(await rows.count()).toBeGreaterThan(2);
    await rows.last().click();
    const name = editor.locator('[name="cut-in-layer-name"]');
    const selectedName = await name.inputValue();
    const details = editor.getByTestId('cut-in-layer-details');
    await expect(editor.locator('[name="cut-in-layer-x"]')).toBeHidden();
    await details.locator('summary').click();
    await expect(editor.locator('[name="cut-in-layer-x"]')).toBeVisible();
    await details.locator('summary').click();
    const stage = editor.locator('[data-stage]');
    const folded = await stage.boundingBox();
    await toggle.click();
    await expect(editor.locator('cut-in-timeline')).toBeVisible();
    await expect(name).toHaveValue(selectedName);
    await expect.poll(async () => (await stage.boundingBox())!.height).toBeLessThan(folded!.height - 10);
    await toggle.click();
    await expect(rows.last()).toBeVisible();
    await expect(name).toHaveValue(selectedName);
    const direction = page.getByTestId('cut-in-direction-details');
    await expect(page.getByTestId('cut-in-multi-direction')).toBeHidden();
    await direction.locator('summary').click();
    await expect(page.getByTestId('cut-in-multi-direction')).toBeVisible();
  });
});
