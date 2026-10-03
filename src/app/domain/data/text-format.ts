/**
 * How a piece of free text is shown: `normal` shows it as typed, `formatted` also reads a small set of
 * Markdown-style marks (headings, lists, quotes and code). The raw text is never rewritten.
 */
export type TextFormat = 'normal' | 'formatted';

export const TEXT_FORMATS: readonly TextFormat[] = ['normal', 'formatted'];

/** Reads a stored or received format, taking anything other than `formatted` as `normal`. */
export function toTextFormat(value: unknown): TextFormat {
  return value === 'formatted' ? 'formatted' : 'normal';
}
