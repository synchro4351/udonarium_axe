/** The most emoji a line may hold and still be drawn large, past which it reads as a row of icons. */
export const MAX_LARGE_EMOJI = 8;

const KEYCAP = /^[0-9#*]\u{FE0F}?\u{20E3}$/u;
const FLAG = /^\p{Regional_Indicator}{2}$/u;
const TAG_FLAG = /^\u{1F3F4}[\u{E0020}-\u{E007E}]+\u{E007F}$/u;
/** Drawn as a picture by default, or asked to be by the presentation selector. */
const PICTURE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\u{FE0F}/u;
/** A letter or digit anywhere in a cluster makes it words, whatever else it holds. */
const WORDISH = /[\p{L}\p{N}]/u;

let segmenter: Intl.Segmenter | null | undefined;

function graphemesOf(text: string): string[] {
  if (segmenter === undefined) {
    segmenter =
      typeof Intl !== 'undefined' && 'Segmenter' in Intl
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null;
  }
  // Without a segmenter, code points are the best there is: a joined emoji then counts as several.
  return segmenter ? Array.from(segmenter.segment(text), (one) => one.segment) : Array.from(text);
}

function isEmojiCluster(cluster: string): boolean {
  if (KEYCAP.test(cluster) || FLAG.test(cluster) || TAG_FLAG.test(cluster)) return true;
  return PICTURE.test(cluster) && !WORDISH.test(cluster);
}

/**
 * How many emoji a line is made of, when it is made of nothing else but spaces between them and
 * of no more than can be drawn large; otherwise 0.
 *
 * A digit, a letter or a sign drawn as text (such as © written without asking for a picture)
 * makes it an ordinary line. The count is by what a reader sees as one emoji, so a family joined
 * into one picture, a flag or a skin tone counts once.
 */
export function largeEmojiCountOf(text: string | null | undefined): number {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) return 0;
  let count = 0;
  for (const cluster of graphemesOf(trimmed)) {
    if (/^\s+$/u.test(cluster)) continue;
    if (!isEmojiCluster(cluster)) return 0;
    if (++count > MAX_LARGE_EMOJI) return 0;
  }
  return count;
}
