import { STAMP_LIMITS, StampItem } from '@axe/domain/media/stamp-pack';

/** A `:word` being typed in chat, and where it sits in the line. */
export interface StampQuery {
  /** What follows the colon. */
  readonly word: string;
  /** Where the colon is. */
  readonly start: number;
  /** Just past the last character of the word. */
  readonly end: number;
}

/** A pack as the suggestions read it. */
export interface StampSuggestionPack {
  readonly identifier: string;
  readonly name: string;
  readonly items: readonly StampItem[];
}

/** A stamp offered for what is being typed. */
export interface StampSuggestion {
  readonly packIdentifier: string;
  readonly packName: string;
  readonly item: StampItem;
  /** The saved word it was found by. */
  readonly word: string;
  /** Whether another pack offers a stamp by the same word or name, so the pack has to be named. */
  readonly showsPack: boolean;
}

/** How many stamps are offered at most, so the list stays one glance long. */
export const MAX_STAMP_SUGGESTIONS = 8;

const QUERY_BEFORE_CARET = new RegExp(`(?:^|\\s)[:：]([^\\s:：]{1,${STAMP_LIMITS.wordLength}})$`, 'u');

/**
 * The `:word` the caret stands at the end of, or null.
 *
 * Only a whole token counts: the colon opens the line or follows a space, and the caret is at the
 * end of the word, with nothing but a space or the end of the line after it. A colon inside a word,
 * a time, a link or a dice command such as `2d6:1` is left alone.
 */
export function stampQueryAt(text: string, caret: number): StampQuery | null {
  if (caret < 1 || caret > text.length) return null;
  const after = text.charAt(caret);
  if (after !== '' && !/\s/u.test(after)) return null;
  const match = QUERY_BEFORE_CARET.exec(text.slice(0, caret));
  if (!match) return null;
  return { word: match[1], start: caret - match[1].length - 1, end: caret };
}

/**
 * The stamps whose saved words begin with the word typed, in any case; those with the word itself
 * come first, then the rest in pack order. A stamp is offered once, under the first word of its
 * that fits. When two packs offer stamps by the same word or name, both are marked to show which
 * pack each comes from.
 */
export function suggestStamps(packs: readonly StampSuggestionPack[], word: string): StampSuggestion[] {
  const needle = word.toLocaleLowerCase();
  if (needle.length === 0) return [];
  const exact: StampSuggestion[] = [];
  const partial: StampSuggestion[] = [];
  for (const pack of packs) {
    for (const item of pack.items) {
      const fits = item.words.filter((one) => one.toLocaleLowerCase().startsWith(needle));
      if (fits.length === 0) continue;
      const same = fits.find((one) => one.toLocaleLowerCase() === needle);
      const found = { packIdentifier: pack.identifier, packName: pack.name, item, word: same ?? fits[0] };
      (same ? exact : partial).push({ ...found, showsPack: false });
    }
  }
  const offered = [...exact, ...partial].slice(0, MAX_STAMP_SUGGESTIONS);
  return offered.map((one) => ({
    ...one,
    showsPack: offered.some(
      (other) =>
        other.packIdentifier !== one.packIdentifier &&
        (other.word.toLocaleLowerCase() === one.word.toLocaleLowerCase() ||
          (other.item.name.length > 0 && other.item.name === one.item.name))
    ),
  }));
}

/**
 * The line with a `:word` taken out, and where the caret goes. A space left doubled where it was,
 * or left over at the start, goes with it; a line left with nothing but spaces is emptied.
 */
export function removeStampQuery(text: string, query: StampQuery): { text: string; caret: number } {
  let before = text.slice(0, query.start);
  let after = text.slice(query.end);
  if (/\s$/u.test(before) && (after.length === 0 || /^\s/u.test(after))) before = before.slice(0, -1);
  else if (before.length === 0) after = after.replace(/^[ \t]+/u, '');
  const joined = before + after;
  if (joined.trim().length === 0) return { text: '', caret: 0 };
  return { text: joined, caret: before.length };
}
