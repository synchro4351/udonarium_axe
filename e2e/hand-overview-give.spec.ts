import { expect, Locator, Page, test } from '@playwright/test';

import { closeFabMenu, openPanel, openTableContextMenu, revealMenuEntry, waitAppReady } from './helpers';

async function becomeGameMaster(page: Page) {
  await page
    .locator('ui-panel')
    .filter({ hasText: '接続情報' })
    .getByRole('button', { name: /^\s*GM\s*$/ })
    .click();
}

async function openCardStackMenu(page: Page) {
  await page.locator('card-stack').first().dispatchEvent('contextmenu');
  const menu = page.locator('context-menu');
  await expect(menu.locator('li').first()).toBeVisible({ timeout: 5000 });
  return menu;
}

/** Deals the deck out to the hands whose line `wanted` picks, taking the others' ticks off. */
async function dealOutTo(page: Page, wanted: (line: string) => boolean) {
  const menu = await openCardStackMenu(page);
  await menu.locator('li', { hasText: /^\s*配り切る\s*$/ }).click();
  const seats = page.getByTestId('deal-choice-seat');
  await expect(seats.first()).toBeVisible({ timeout: 5000 });
  for (const label of await page.getByTestId('deal-choice-list').locator('label').all()) {
    const text = (await label.textContent()) ?? '';
    const box = label.getByTestId('deal-choice-seat');
    if ((await box.isChecked()) !== wanted(text)) await box.click();
  }
  await page.getByTestId('deal-choice-confirm').click();
}

async function openOverview(page: Page): Promise<Locator> {
  await page.locator('app-hand-rail').locator('[data-testid="hand-overview-open"]').click();
  const panel = page.locator('hand-overview-panel');
  await expect(panel).toBeVisible({ timeout: 5000 });
  return panel;
}

function section(panel: Locator, name: string): Locator {
  return panel.getByTestId('hand-overview-section').filter({ hasText: name });
}

/** Presses on one element and lets go over another, moving in steps as a hand would. */
async function dragOnto(page: Page, from: Locator, to: Locator) {
  const start = (await from.boundingBox())!;
  const end = (await to.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
}

test.describe("the window of everyone's hands", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui-lang', 'ja'));
    await waitAppReady(page);
    await becomeGameMaster(page);
    await closeFabMenu(page);
    const tableMenu = await openTableContextMenu(page);
    await (await revealMenuEntry(page, tableMenu, 'トランプの山札を作成')).click();
    await expect(page.locator('card-stack').first()).toBeAttached({ timeout: 10000 });
    const monster = page.locator('game-character').filter({ hasText: 'モンスターA' }).first();
    await monster.locator('img').first().dispatchEvent('contextmenu');
    await page.locator('context-menu li').filter({ hasText: '手札を持たせる' }).first().click();
    await openPanel(page, '手札');
    await expect(page.locator('app-hand-rail .hand-rail')).toBeVisible({ timeout: 5000 });
    await closeFabMenu(page);
  });

  test('deals the deck out only to the hands ticked, a character among them', async ({ page }) => {
    await dealOutTo(page, (line) => line.includes('モンスターA'));

    const panel = await openOverview(page);
    await expect(section(panel, 'モンスターA')).toContainText('53 枚', { timeout: 15000 });
    await expect(section(panel, '（自分）')).toContainText('0 枚');
    await expect(panel.getByTestId('hand-overview-give-rule')).toHaveText('手札を渡す：ON');
  });

  test("gives a card from one's own hand to another hand by dragging it across the window", async ({ page }) => {
    await dealOutTo(page, (line) => !line.includes('モンスターA'));
    const panel = await openOverview(page);
    const mine = section(panel, '（自分）');
    await expect(mine).toContainText('53 枚', { timeout: 15000 });
    // The character's section comes after a long hand: it is scrolled to, and the card nearest it taken.
    const target = section(panel, 'モンスターA');
    await target.scrollIntoViewIfNeeded();

    await dragOnto(page, mine.getByTestId('hand-overview-card').last(), target);

    await expect(section(panel, 'モンスターA')).toContainText('1 枚', { timeout: 5000 });
    await expect(mine).toContainText('52 枚');
  });

  test('gives a card from the table to the hand it is let go over in the window', async ({ page }) => {
    const menu = await openCardStackMenu(page);
    await menu.locator('li', { hasText: '山札を崩す' }).click();
    await expect(page.locator('card').first()).toBeAttached({ timeout: 10000 });
    const panel = await openOverview(page);
    // The window opens over the deck the cards were spread from, so it is moved aside by its bar.
    const frame = page.locator('ui-panel', { has: panel });
    const bar = (await frame.locator('.bg-ui-titlebar').first().boundingBox())!;
    await page.mouse.move(bar.x + 60, bar.y + bar.height / 2);
    await page.mouse.down();
    await page.mouse.move(420, 120, { steps: 10 });
    await page.mouse.up();

    await dragOnto(page, page.locator('card .pointer-events-auto').first(), section(panel, 'モンスターA'));

    await expect(section(panel, 'モンスターA')).toContainText('1 枚', { timeout: 5000 });
  });
});
