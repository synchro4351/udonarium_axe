import { ChatPalette } from '@axe/domain/chat/chat-palette';
import {
  MAX_PALETTE_SUGGESTIONS,
  paletteLineText,
  suggestPaletteLines,
} from '@axe/domain/chat/chat-palette-suggestion';

describe('suggestPaletteLines', () => {
  let palette: ChatPalette;

  beforeEach(() => {
    palette = new ChatPalette();
    palette.initialize();
    palette.setPalette('//---戦闘---\n◆技能\n//武器=2\n2d6+{武器} 攻撃\n\n2d6 回避\nCC<=50 目星');
  });

  afterEach(() => palette.destroy());

  it('offers the lines holding the draft, in palette order and in any case', () => {
    expect(suggestPaletteLines(palette, '2d6')).toEqual(['2d6+{武器} 攻撃', '2d6 回避']);
    expect(suggestPaletteLines(palette, 'cc<')).toEqual(['CC<=50 目星']);
  });

  it('leaves out headings, variables, blank lines and the line that is the draft already', () => {
    expect(suggestPaletteLines(palette, '戦闘')).toEqual([]);
    expect(suggestPaletteLines(palette, '武器')).toEqual(['2d6+{武器} 攻撃']);
    expect(suggestPaletteLines(palette, '2d6 回避')).toEqual([]);
  });

  it('waits for two characters, and offers nothing without a palette', () => {
    expect(suggestPaletteLines(palette, '2')).toEqual([]);
    expect(suggestPaletteLines(palette, ' 2 ')).toEqual([]);
    expect(suggestPaletteLines(null, '2d6')).toEqual([]);
  });

  it('offers no more than a glance holds', () => {
    palette.setPalette(Array.from({ length: 20 }, (_, i) => `1d${i + 2} roll`).join('\n'));

    expect(suggestPaletteLines(palette, 'roll')).toHaveLength(MAX_PALETTE_SUGGESTIONS);
  });
});

describe('paletteLineText', () => {
  it('turns each written \\n into a line break', () => {
    expect(paletteLineText('first\\nsecond')).toBe('first\nsecond');
  });
});
