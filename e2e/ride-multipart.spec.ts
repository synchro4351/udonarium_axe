import { expect, Locator, Page, test } from '@playwright/test';

import { revealMenuEntry, waitAppReady } from './helpers';
import { centreOf, pedestal, pinnedPiece, placeOf, Point, settle } from './see-through-helpers';

async function becomeGm(page: Page) {
  await page
    .locator('ui-panel')
    .filter({ hasText: '接続情報' })
    .getByRole('button', { name: /^\s*GM\s*$/ })
    .click();
  await expect(page.locator('app-gm-toolbar button').first()).toBeVisible({ timeout: 10000 });
}

async function closePanels(page: Page) {
  const panels = page.locator('ui-panel');
  for (let round = 0; round < 8 && (await panels.count()) > 0; round++) {
    await panels.first().locator('.bg-ui-titlebar button', { hasText: 'close' }).dispatchEvent('click');
  }
  await expect(panels).toHaveCount(0);
}

async function drag(page: Page, from: Point, to: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

async function chooseFromMenu(page: Page, who: Locator, entry: string) {
  await who.dispatchEvent('contextmenu');
  const menu = page.locator('context-menu');
  await expect(menu.locator('li').first()).toBeVisible({ timeout: 5000 });
  await (await revealMenuEntry(page, menu, entry)).click();
  await expect(page.locator('context-menu')).toHaveCount(0, { timeout: 5000 });
  await page.mouse.move(5, 400);
}

/** Where a piece stands on the table, read from the translation its transform starts with. */
async function spot(of: Locator): Promise<Point> {
  const transform = await placeOf(of);
  const numbers = [...transform.matchAll(/translate[XYZ3d]*\(([^)]*)\)/g)].flatMap((m) =>
    m[1].split(',').map((part) => parseFloat(part))
  );
  return { x: numbers[0], y: numbers[1] };
}

function gap(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
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

test('carries a rider with a linked part used as a mount, whichever part is dragged, without moving it twice', async ({
  page,
}) => {
  await waitAppReady(page);
  await becomeGm(page);
  await splitMonster(page);
  await closePanels(page);

  const tokens = page.locator('game-character');
  const head = tokens.filter({ has: page.getByTestId('part-name').filter({ hasText: '頭部' }) });
  const body = tokens.filter({ has: page.getByTestId('part-name').filter({ hasText: '胴体' }) });
  await expect(head).toHaveCount(1);
  await expect(body).toHaveCount(1);

  const rider = await pinnedPiece(page, 'キャラクターA');
  await chooseFromMenu(page, head, '乗り物にする');
  await settle(rider);
  // A part stands where the whole picture stood, its own region drawn off to one side, so getting
  // on is judged at the piece's centre rather than at the region shown.
  await drag(page, await centreOf(pedestal(rider)), await centreOf(pedestal(head)));
  await settle(rider);
  const offer = page.getByTestId('snackbar');
  await expect(offer).toContainText('キャラクターA', { timeout: 5000 });
  await offer.getByTestId('snackbar-action').click();
  await expect(head.getByTestId('piece-riders').first()).toContainText('1', { timeout: 5000 });

  const before = { head: await spot(head), body: await spot(body), rider: await spot(rider) };
  const riderOnHead = gap(before.rider, before.head);
  const bodyOnHead = gap(before.body, before.head);

  // Dragging the other part moves the whole group, the mount among it, and the mount its rider.
  const bodyAt = await centreOf(body.getByTestId('part-region'));
  await drag(page, bodyAt, { x: bodyAt.x + 100, y: bodyAt.y + 50 });
  await settle(head);
  await settle(rider);
  const afterBody = { head: await spot(head), body: await spot(body), rider: await spot(rider) };
  expect(Math.hypot(afterBody.head.x - before.head.x, afterBody.head.y - before.head.y)).toBeGreaterThan(30);
  expect(gap(afterBody.body, afterBody.head)).toEqual(bodyOnHead);
  expect(gap(afterBody.rider, afterBody.head)).toEqual(riderOnHead);

  // Dragging the mount part itself carries both the other part and the rider once each.
  const headAt = await centreOf(head.getByTestId('part-region'));
  await drag(page, headAt, { x: headAt.x - 80, y: headAt.y + 60 });
  await settle(head);
  await settle(rider);
  const afterHead = { head: await spot(head), body: await spot(body), rider: await spot(rider) };
  expect(Math.hypot(afterHead.head.x - afterBody.head.x, afterHead.head.y - afterBody.head.y)).toBeGreaterThan(30);
  expect(gap(afterHead.body, afterHead.head)).toEqual(bodyOnHead);
  expect(gap(afterHead.rider, afterHead.head)).toEqual(riderOnHead);
});
