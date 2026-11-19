import { BUILTIN_STAMPS } from '@axe/domain/chat/stamp-catalog';
import { normalizeStampWord, STAMP_WORDS, stampMatchesQuery } from '@axe/domain/chat/stamp-words';

describe('stamp words', () => {
  it('names only stamps the app comes with', () => {
    const known = new Set(BUILTIN_STAMPS.map((stamp) => stamp.id));

    expect(Object.keys(STAMP_WORDS).filter((id) => !known.has(id))).toEqual([]);
  });

  it('reads katakana as hiragana, and full and half width alike', () => {
    expect(normalizeStampWord('ヒラメキ')).toBe('ひらめき');
    expect(normalizeStampWord('ﾋﾗﾒｷ')).toBe('ひらめき');
    expect(normalizeStampWord('ＯＫ')).toBe('ok');
  });

  it('finds a stamp by any of its names or words, in part, and everything for nothing searched', () => {
    expect(stampMatchesQuery(['ひらめいた!', ...STAMP_WORDS['explore:idea']], 'アイデア')).toBe(true);
    expect(stampMatchesQuery(['ひらめいた!'], 'ひらめ')).toBe(true);
    expect(stampMatchesQuery(['ひらめいた!'], '休憩')).toBe(false);
    expect(stampMatchesQuery(['ひらめいた!'], '  ')).toBe(true);
  });
});
