import { isReactionEmoji } from '@axe/domain/chat/chat-reaction';
import {
  MAX_REACTION_SEARCH_RESULTS,
  searchReactionEmojis,
  typedReactionEmoji,
} from '@axe/features/chat/chat-message-reactions/reaction-emoji-catalog';

describe('reaction emoji catalog', () => {
  it('takes one emoji, trimmed, however many code points it is built from', () => {
    expect(typedReactionEmoji(' 🦄 ')).toBe('🦄');
    for (const emoji of ['❤️', '👍🏽', '🇯🇵', '👨‍👩‍👧', '#️⃣']) {
      expect(typedReactionEmoji(emoji)).toBe(emoji);
    }
  });

  it('refuses text, mixed text and several emoji at once', () => {
    for (const text of ['', 'ok', 'x👍', '👍 👍', '👍👍', '123', 'いいね']) {
      expect(typedReactionEmoji(text)).toBeNull();
    }
  });

  it('finds emoji by any of their names, ignoring case', () => {
    expect(searchReactionEmojis('THUMBS')).toEqual(['👍', '👎']);
    expect(searchReactionEmojis('サイコロ')).toEqual(['🎲']);
    expect(searchReactionEmojis('주사위')).toEqual(['🎲']);
    expect(searchReactionEmojis('')).toEqual([]);
  });

  it('only offers what a reaction may hold, and not too many at once', () => {
    const everything = searchReactionEmojis('o');
    expect(everything.length).toBeGreaterThan(0);
    expect(everything.length).toBeLessThanOrEqual(MAX_REACTION_SEARCH_RESULTS);
    expect(everything.every((emoji) => isReactionEmoji(emoji))).toBe(true);
  });
});
