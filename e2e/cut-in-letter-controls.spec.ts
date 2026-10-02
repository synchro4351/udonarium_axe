import { expect, type Locator, type Page, test } from '@playwright/test';

import { openPanel, waitAppReady } from './helpers';

/** How opaque each letter of the text layer reading `text` is on the stage right now. */
async function opacities(page: Page, text: string): Promise<number[]> {
  const letters = page
    .locator('cut-in-scene-editor')
    .getByTestId('cut-in-letters')
    .filter({ hasText: text })
    .locator('[data-letter]');
  return letters.evaluateAll((elements) => elements.map((element) => Number(getComputedStyle(element).opacity)));
}

/** Holds the scene at a moment, as typing into the time field does. */
async function seek(page: Page, seconds: number): Promise<void> {
  const field = page.locator('cut-in-scene-editor input[name="cut-in-seek-seconds"]');
  await field.fill(String(seconds));
  await field.dispatchEvent('change');
}

async function expectOpacities(page: Page, text: string, wanted: number[]): Promise<void> {
  await expect
    .poll(async () => (await opacities(page, text)).map((opacity) => Math.round(opacity * 10) / 10))
    .toEqual(wanted);
}

function iconButton(editor: Locator, icon: string): Locator {
  return editor.locator('button', {
    has: editor.page().locator('i.material-icons', { hasText: new RegExp(`^${icon}$`) }),
  });
}

test('per-letter controls set the order, timing and exit the browser plays, and undo takes them back', async ({
  page,
}) => {
  await waitAppReady(page);
  await openPanel(page, 'カットイン');
  await page.getByTestId('cut-in-scene-template').selectOption('portrait');
  const editor = page.locator('cut-in-scene-editor');
  await expect(editor).toBeVisible();

  await iconButton(editor, 'title').first().click();
  await editor.locator('textarea[name="cut-in-layer-text"]').fill('WXYZ');

  // The simple looks come first; the detailed controls stay folded until asked for.
  const details = editor.getByTestId('cut-in-letter-details');
  await expect(editor.getByTestId('cut-in-letterOrder')).toBeHidden();
  await editor.getByTestId('cut-in-letter-preset-fade').click();
  await expect(editor.getByTestId('cut-in-layer-letter-motion')).toHaveValue('fade');

  await details.locator('summary').click();
  // A fade comes in where it rests, so it has no way in; without an exit, no exit length either.
  await expect(editor.getByTestId('cut-in-letterDirection')).toBeDisabled();
  await expect(editor.getByTestId('cut-in-letterExitDurationMs')).toBeDisabled();
  await editor.getByTestId('cut-in-letterIntervalMs').fill('200');
  await editor.getByTestId('cut-in-letterDurationMs').fill('200');
  await editor.getByTestId('cut-in-letterOrder').selectOption('reverse');

  // From the end: Z first, then Y 200 ms later, each taking 200 ms to fade in.
  await seek(page, 0.1);
  await expectOpacities(page, 'WXYZ', [0, 0, 0, 0.5]);
  await seek(page, 0.3);
  await expectOpacities(page, 'WXYZ', [0, 0, 0.5, 1]);

  // Taking the order back plays it from the start again, at the same moment.
  await iconButton(editor, 'undo').click();
  await expect(editor.getByTestId('cut-in-letterOrder')).toHaveValue('forward');
  await expectOpacities(page, 'WXYZ', [1, 0.5, 0, 0]);
  await iconButton(editor, 'redo').click();
  await expect(editor.getByTestId('cut-in-letterOrder')).toHaveValue('reverse');
  await expectOpacities(page, 'WXYZ', [0, 0, 0.5, 1]);

  // From the middle out: X, then Y, then W, then Z.
  await editor.getByTestId('cut-in-letterOrder').selectOption('center');
  await seek(page, 0.5);
  await expectOpacities(page, 'WXYZ', [0.5, 1, 1, 0]);

  // Every letter has left by the time the layer, here the whole scene, comes to its end.
  await editor.getByTestId('cut-in-letterExit').selectOption('fade');
  await expect(editor.getByTestId('cut-in-letterExitDurationMs')).toBeEnabled();
  await seek(page, 999);
  await expectOpacities(page, 'WXYZ', [0, 0, 0, 0]);
});
