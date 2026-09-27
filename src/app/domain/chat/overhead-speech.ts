import { largeEmojiCountOf } from '@axe/domain/chat/emoji-only-text';

/** What a bubble over a speaking piece says: words, a stamp's picture, or a few emoji. */
export type OverheadSpeech =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'emoji'; readonly text: string }
  | { readonly kind: 'stamp'; readonly imageIdentifier: string; readonly name: string };

/** The most characters a bubble shows, past which it is cut short so it covers less of the table. */
export const MAX_OVERHEAD_SPEECH_CHARS = 80;

/** Each pair of marks a spoken line may be wrapped in, and nothing else. */
const QUOTED = /「([^「」]*)」|“([^“”]*)”|"([^"\n]*)"/g;
/** Ruby written as `|base《reading》` shows its base alone. */
const RUBY = /[|｜]([^|｜\s]+?)《.+?》/g;

/**
 * The quoted parts of a line, in order: what is inside 「…」, “…” or "…", with the marks taken off.
 *
 * Only a mark that is closed counts, and a pair holding nothing but spaces is passed over. The
 * rest of the line, narration or an aside, is never among them.
 */
export function quotedSegmentsOf(text: string | null | undefined): string[] {
  const segments: string[] = [];
  for (const match of (text ?? '').matchAll(QUOTED)) {
    const inner = (match[1] ?? match[2] ?? match[3] ?? '').replace(RUBY, '$1').trim();
    if (inner.length > 0) segments.push(inner);
  }
  return segments;
}

/** The line cut to the most a bubble shows, counting what a reader sees as one character. */
function clip(text: string): string {
  const characters = Array.from(text);
  if (characters.length <= MAX_OVERHEAD_SPEECH_CHARS) return text;
  return `${characters.slice(0, MAX_OVERHEAD_SPEECH_CHARS - 1).join('')}…`;
}

/**
 * What a line puts over its speaker's head, or null for a line that puts nothing there.
 *
 * A stamp shows its picture and a line of emoji alone shows them as they are. Any other line shows
 * only what it quotes, one quotation to a row, so narration and asides written outside quotation
 * marks stay in the log.
 */
export function overheadSpeechOf(line: {
  readonly text: string | null | undefined;
  readonly stampName?: string | null;
  readonly attachmentImageIdentifierList: readonly string[];
}): OverheadSpeech | null {
  const images = line.attachmentImageIdentifierList;
  if (line.stampName) {
    return images.length > 0 ? { kind: 'stamp', imageIdentifier: images[0], name: line.stampName } : null;
  }
  const text = line.text ?? '';
  if (largeEmojiCountOf(text) > 0) return { kind: 'emoji', text: text.trim() };
  const segments = quotedSegmentsOf(text);
  if (segments.length < 1) return null;
  return { kind: 'text', text: clip(segments.join('\n')) };
}

/** How long a bubble stays, in milliseconds: long enough to read, and no longer. */
export function overheadSpeechHoldMs(speech: OverheadSpeech): number {
  if (speech.kind !== 'text') return 4000;
  return Math.min(9000, 3000 + Array.from(speech.text).length * 90);
}
