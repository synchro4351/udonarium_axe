/**
 * The ruby notation, read from text as it was typed: `|base《reading》` or `|base<reading>`.
 *
 * The bar may be half- or full-width `|` / `｜`. The double-bracket form reads as it always has:
 * the base runs to the first `《` without a space or a bar, and the reading to the next `》` on the
 * same line. The angle-bracket form is stricter, so comparisons, arithmetic and markup stay text:
 * the base holds no space, bar or angle bracket and is followed by `<` at once, and the reading
 * holds no bar, angle bracket or line break and something other than spaces. Where both could start
 * at one bar, the double-bracket form wins, and since the angle-bracket form never holds a bar, a
 * line that read as ruby before still reads the same way.
 *
 * Every reader of the notation (the chat, shared notes, logs, speech, bubbles and effect tokens)
 * goes through here, so they agree on which words carry a reading.
 */

const RUBY_NOTATION = /[|｜](?:([^|｜\s]+?)《(.+?)》|([^|｜\s<>]+)<([^|｜<>\r\n\u2028\u2029]+)>)/g;

/** A run of text as the ruby notation cuts it: plain text, or words with a reading over them. */
export interface RubyNotationRun {
  /** The run as it was typed, the notation included. */
  readonly raw: string;
  /** The words shown: the base of a ruby, or the plain text itself. */
  readonly text: string;
  /** The reading set over the words; empty for plain text. */
  readonly reading: string;
}

/** Cuts text into plain runs and ruby runs, in order. Empty text gives no runs. */
export function rubyNotationRuns(text: string): RubyNotationRun[] {
  const runs: RubyNotationRun[] = [];
  const plain = (from: number, to: number) => {
    if (to > from) {
      const slice = text.slice(from, to);
      runs.push({ raw: slice, text: slice, reading: '' });
    }
  };
  let at = 0;
  for (const match of text.matchAll(RUBY_NOTATION)) {
    if (match[4] !== undefined && match[4].trim().length === 0) continue;
    plain(at, match.index);
    runs.push({ raw: match[0], text: match[1] ?? match[3], reading: match[2] ?? match[4] });
    at = match.index + match[0].length;
  }
  plain(at, text.length);
  return runs;
}

/**
 * Rewrites each ruby in text with `ruby(base, reading)`, and the text between them with `plain`,
 * which leaves it as it is unless given.
 */
export function replaceRubyNotation(
  text: string,
  ruby: (base: string, reading: string) => string,
  plain: (text: string) => string = (run) => run
): string {
  return rubyNotationRuns(text)
    .map((run) => (run.reading.length > 0 ? ruby(run.text, run.reading) : plain(run.text)))
    .join('');
}
