import { largeEmojiCountOf, MAX_LARGE_EMOJI } from '@axe/domain/chat/emoji-only-text';

describe('largeEmojiCountOf()', () => {
  it('counts a line of emoji and nothing else', () => {
    expect(largeEmojiCountOf('😀')).toBe(1);
    expect(largeEmojiCountOf(' 🎉 🎲\n✨ ')).toBe(3);
  });

  it('counts an emoji joined, toned or paired into one picture once', () => {
    expect(largeEmojiCountOf('👨‍👩‍👧‍👦')).toBe(1);
    expect(largeEmojiCountOf('👍🏽')).toBe(1);
    expect(largeEmojiCountOf('🇯🇵')).toBe(1);
    expect(largeEmojiCountOf('❤️')).toBe(1);
    expect(largeEmojiCountOf('1️⃣')).toBe(1);
  });

  it('leaves a line with any words, digits or signs in it as it is', () => {
    expect(largeEmojiCountOf('やったね😀')).toBe(0);
    expect(largeEmojiCountOf('ok 👍')).toBe(0);
    expect(largeEmojiCountOf('2d6 🎲')).toBe(0);
    expect(largeEmojiCountOf('1')).toBe(0);
    expect(largeEmojiCountOf('！！')).toBe(0);
    expect(largeEmojiCountOf('©')).toBe(0);
  });

  it('leaves an empty line, or one of spaces, as it is', () => {
    expect(largeEmojiCountOf('')).toBe(0);
    expect(largeEmojiCountOf('   ')).toBe(0);
    expect(largeEmojiCountOf(null)).toBe(0);
  });

  it('leaves a line of more emoji than are drawn large as it is', () => {
    expect(largeEmojiCountOf('😀'.repeat(MAX_LARGE_EMOJI))).toBe(MAX_LARGE_EMOJI);
    expect(largeEmojiCountOf('😀'.repeat(MAX_LARGE_EMOJI + 1))).toBe(0);
  });
});
