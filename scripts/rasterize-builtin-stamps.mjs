#!/usr/bin/env node
// 同梱の文字スタンプ `src/assets/images/stamps/*.svg` を、同じ場所の透過 PNG に書き出す。
// SVG の <text> は閲覧する端末のフォントで描かれ、参加者ごとに見た目が変わるため、配布するのは PNG。
// 文字は同梱の Noto Sans JP Bold (fonts/replay) で描くので、誰が書き出しても同じ字形になる。
// SVG は作図の元として残し、ビルドには含めない (angular.json の assets.ignore)。
// 使い方: node scripts/rasterize-builtin-stamps.mjs (Playwright の Chromium を使う)
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 240;

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const stampDir = resolve(root, 'src/assets/images/stamps');
const font = readFileSync(resolve(root, 'src/assets/fonts/replay/noto-sans-jp-700.woff2')).toString('base64');

const page = (svg) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Axe Stamp'; font-weight: 100 900; src: url(data:font/woff2;base64,${font}) format('woff2'); }
html, body { margin: 0; background: transparent; }
svg { display: block; width: ${SIZE}px; height: ${SIZE}px; }
svg text { font-family: 'Axe Stamp' !important; }
</style></head><body>${svg}</body></html>`;

const browser = await chromium.launch();
try {
  const tab = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  for (const file of readdirSync(stampDir).filter((name) => name.endsWith('.svg'))) {
    const svg = readFileSync(resolve(stampDir, file), 'utf8');
    await tab.setContent(page(svg));
    await tab.evaluate(() => document.fonts.ready);
    const loaded = await tab.evaluate(() => document.fonts.check("900 64px 'Axe Stamp'"));
    if (!loaded) throw new Error(`[rasterize-builtin-stamps] font not loaded for ${file}`);
    const png = await tab.locator('svg').screenshot({ omitBackground: true });
    writeFileSync(resolve(stampDir, file.replace(/\.svg$/, '.png')), png);
    console.log(`[rasterize-builtin-stamps] ${file} -> ${png.length} bytes`);
  }
} finally {
  await browser.close();
}
