import { expect, test } from '@playwright/test';

test('compares text outlines on a patterned background without changing glyph metrics', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1050, height: 520 });
  const text =
    'アイテムには十分な装着スロットと灯火の対象を満たしている必要がある。1時間が必要。\n\nlv2\n新たなアイテムを用意しなくても元のアイテムを破壊し、灯火を全て回収できる。\n\nlv3\nアイテムの破壊なく灯火を回収できる。';
  const halo = Array(8).fill('#ffffff 0px 0px 1.5px').join(', ');
  // These fixtures isolate paint differences; the application flow is covered in card-text-outline.spec.ts.
  await page.setContent(`<!doctype html><style>
    body { margin: 0; padding: 18px; background: #ececec; font-family: Arial, Meiryo, sans-serif; }
    main { display: flex; gap: 18px; }
    section { width: 326px; }
    h2 { font-size: 16px; margin: 0 0 12px; }
    .card { box-sizing: border-box; width: 326px; height: 440px; padding: 18px;
      background: repeating-linear-gradient(35deg, #ffffff06 0 3px, transparent 3px 9px),
        radial-gradient(ellipse at 30% 40%, #71634c, #2a221c 85%);
      border: 8px ridge #806043; color: #16171c; text-align: center;
      font-size: 20px; line-height: 1.65; white-space: pre-line; overflow: hidden; }
    #old { -webkit-text-stroke: 1.5px #fff; paint-order: stroke fill; }
    #halo { font-weight: 700; }
    #bold { text-shadow: ${halo}; font-weight: 700; }
  </style><main>
    <section><h2>Previous: stroke / regular</h2><div class="card" id="old"><span></span></div></section>
    <section><h2>Updated: bold / outline OFF</h2><div class="card" id="halo"><span></span></div></section>
    <section><h2>Updated: bold / outline ON</h2><div class="card" id="bold"><span></span></div></section>
  </main>`);
  await page.locator('.card span').evaluateAll((elements, content) => {
    elements.forEach((element) => {
      element.textContent = content;
    });
  }, text);
  const boxes = await page.locator('.card span').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })
  );
  expect(boxes[2]).toEqual(boxes[1]);
  await page.screenshot({ path: testInfo.outputPath('outline-comparison.png') });
});
