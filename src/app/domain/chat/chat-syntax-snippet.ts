/**
 * One of the chat's own ways of writing (ruby, a secret roll, a resource change and the like),
 * as the stamp picker offers to put it into the line.
 *
 * It is written `before`, `fill`, `middle`, `second`, `after`. `fill` stands where the writer
 * fills in, and the words picked out in the box go there instead; `second` is a further place to
 * fill, picked out once the first already holds those words.
 */
export interface ChatSyntaxSnippet {
  readonly id: string;
  readonly before: string;
  readonly fill: string;
  readonly middle?: string;
  readonly second?: string;
  readonly after?: string;
  /**
   * Where it goes: where the caret is, at the start of the caret's line (only `before`, plus
   * `fill` on an empty line), or at the end of that line after a space.
   */
  readonly place?: 'caret' | 'lineStart' | 'lineEnd';
}

/** The words the placeholders stand in, in the reader's language. */
export interface ChatSyntaxPlaceholders {
  readonly rubyBase: string;
  readonly rubyReading: string;
  readonly resource: string;
  readonly buffName: string;
  readonly effectName: string;
}

/** The box after a snippet went in, with what is to be picked out next. */
export interface ChatSyntaxEdit {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

/**
 * The ways of writing offered, each grounded in what the chat already reads (see the chat syntax
 * page of the manual): ruby, a secret roll, a quotation, changing the speaker's or the target's
 * resource, a buff, a sheet reference, a portrait switch and a map effect.
 */
export function chatSyntaxSnippets(words: ChatSyntaxPlaceholders): ChatSyntaxSnippet[] {
  return [
    { id: 'ruby', before: '|', fill: words.rubyBase, middle: '《', second: words.rubyReading, after: '》' },
    { id: 'secretDice', before: 'S', fill: '2d6', place: 'lineStart' },
    { id: 'quote', before: '> ', fill: '', place: 'lineStart' },
    { id: 'resource', before: ':', fill: words.resource, middle: '-', second: '1' },
    { id: 'targetResource', before: 't:', fill: words.resource, middle: '-', second: '1' },
    { id: 'buff', before: '&', fill: words.buffName, middle: '/', second: '3' },
    { id: 'reference', before: '{', fill: words.resource, after: '}' },
    { id: 'portrait', before: '@', fill: '2', place: 'lineEnd' },
    { id: 'effect', before: '《', fill: words.effectName, after: '》' },
  ];
}

/** How a snippet reads written out whole, for the picker to show beside its name. */
export function chatSyntaxExample(snippet: ChatSyntaxSnippet): string {
  return snippet.before + snippet.fill + (snippet.middle ?? '') + (snippet.second ?? '') + (snippet.after ?? '');
}

/**
 * Puts a snippet into the text, where its `place` says, and says what to pick out next: the
 * placeholder to overwrite, or the caret just past what went in when there is none left.
 */
export function applyChatSyntax(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  snippet: ChatSyntaxSnippet
): ChatSyntaxEdit {
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  const place = snippet.place ?? 'caret';

  if (place === 'lineStart') {
    const lineStart = startOfLine(text, start);
    const lineEnd = endOfLine(text, start);
    if (text.startsWith(snippet.before, lineStart)) return { text, selectionStart: start, selectionEnd: end };
    if (text.slice(lineStart, lineEnd).trim().length === 0) {
      // An empty line takes the placeholder as well, picked out to be written over.
      const at = lineStart + snippet.before.length;
      const next = text.slice(0, lineStart) + snippet.before + snippet.fill + text.slice(lineEnd);
      return { text: next, selectionStart: at, selectionEnd: at + snippet.fill.length };
    }
    const shift = snippet.before.length;
    const next = text.slice(0, lineStart) + snippet.before + text.slice(lineStart);
    return { text: next, selectionStart: start + shift, selectionEnd: end + shift };
  }

  if (place === 'lineEnd') {
    const lineEnd = endOfLine(text, end);
    const lineStart = startOfLine(text, lineEnd);
    const line = text.slice(lineStart, lineEnd);
    const separator = line.length > 0 && !/\s$/u.test(line) ? ' ' : '';
    const at = lineEnd + separator.length + snippet.before.length;
    const inserted = separator + chatSyntaxExample(snippet);
    return {
      text: text.slice(0, lineEnd) + inserted + text.slice(lineEnd),
      selectionStart: at,
      selectionEnd: at + snippet.fill.length,
    };
  }

  const picked = text.slice(start, end);
  const first = picked || snippet.fill;
  const middle = snippet.middle ?? '';
  const second = snippet.second ?? '';
  const inserted = snippet.before + first + middle + second + (snippet.after ?? '');
  const next = text.slice(0, start) + inserted + text.slice(end);
  const firstAt = start + snippet.before.length;
  if (!picked && first) return { text: next, selectionStart: firstAt, selectionEnd: firstAt + first.length };
  if (second) {
    const secondAt = firstAt + first.length + middle.length;
    return { text: next, selectionStart: secondAt, selectionEnd: secondAt + second.length };
  }
  return { text: next, selectionStart: start + inserted.length, selectionEnd: start + inserted.length };
}

// A search back from before the first character would still look at the first one.
function startOfLine(text: string, at: number): number {
  return at <= 0 ? 0 : text.lastIndexOf('\n', at - 1) + 1;
}

function endOfLine(text: string, from: number): number {
  const at = text.indexOf('\n', from);
  return at < 0 ? text.length : at;
}
