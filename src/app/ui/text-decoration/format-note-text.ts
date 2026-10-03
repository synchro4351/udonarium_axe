/* The "formatted" display of a shared note: a deliberately small subset of Markdown.
   Only headings (# to ###, followed by a space), "-" and "1." lists, ">" quotes and inline or
   fenced code are read. Emphasis, "*" and "+" bullets, tables, raw HTML, links, images and
   automatic links are switched off and stay as literal text. Every piece of text goes through
   escapeHtml, and the ruby notation is applied to ordinary text only, never inside code. */

import { TextFormat } from '@axe/domain/data/text-format';
import { decorateChatStyleText, escapeHtml, escapeHtmlWithRuby } from '@axe/ui/text-decoration/decorate-chat-text';
import { Marked, Tokenizer, type Tokens } from 'marked';

const HEADING_START = /^ {0,3}#{1,3}[ \t]/;
const LIST_MARKER = /^ {0,3}(?:-|\d{1,9}\.)[ \t]/;
const QUOTE_LINE = /^ {0,3}>/;
const BLANK_OR_INDENTED_LINE = /^(?:[ \t]|$)/;

/**
 * The leading lines of `src` that `keep` accepts, the first line always included.
 *
 * Used to stop lists and quotes at the first line that does not belong to them, instead of
 * Markdown's "lazy continuation", so an ordinary line after them stays an ordinary line.
 */
function leadingLines(src: string, keep: (line: string) => boolean): string {
  let end = 0;
  while (end < src.length) {
    const newline = src.indexOf('\n', end);
    const lineEnd = newline === -1 ? src.length : newline;
    if (end > 0 && !keep(src.slice(end, lineEnd))) break;
    end = newline === -1 ? src.length : newline + 1;
  }
  return src.slice(0, end);
}

/** Escapes plain note text, applies the ruby notation, and keeps each line break. */
function decoratePlainText(text: string): string {
  return escapeHtmlWithRuby(text).split('\n').join('<br>');
}

const noteMarked = new Marked({
  async: false,
  gfm: false,
  breaks: false,
  pedantic: false,
  tokenizer: {
    heading(src) {
      return HEADING_START.test(src) ? Tokenizer.prototype.heading.call(this, src) : undefined;
    },
    list(src) {
      if (!LIST_MARKER.test(src)) return undefined;
      const lines = leadingLines(src, (line) => BLANK_OR_INDENTED_LINE.test(line) || LIST_MARKER.test(line));
      return Tokenizer.prototype.list.call(this, lines);
    },
    blockquote(src) {
      if (!QUOTE_LINE.test(src)) return undefined;
      return Tokenizer.prototype.blockquote.call(
        this,
        leadingLines(src, (line) => QUOTE_LINE.test(line))
      );
    },
    // Indented code, rules, raw HTML, link definitions, tables and underlined headings.
    code: () => undefined,
    hr: () => undefined,
    html: () => undefined,
    def: () => undefined,
    table: () => undefined,
    lheading: () => undefined,
    // Inline HTML, links, images, emphasis, strikethrough and automatic links.
    tag: () => undefined,
    link: () => undefined,
    reflink: () => undefined,
    emStrong: () => undefined,
    del: () => undefined,
    autolink: () => undefined,
    url: () => undefined,
  },
  renderer: {
    text(token: Tokens.Text | Tokens.Escape) {
      if ('tokens' in token && token.tokens) return this.parser.parseInline(token.tokens);
      if ('escaped' in token && token.escaped) return token.text;
      return decoratePlainText(token.text);
    },
    code({ text }: Tokens.Code) {
      return `<pre><code>${escapeHtml(text)}</code></pre>\n`;
    },
    // The tokenizers above never produce these; they are kept as literal text should one appear.
    html({ raw }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(raw);
    },
    link({ raw }: Tokens.Link) {
      return escapeHtml(raw);
    },
    image({ raw }: Tokens.Image) {
      return escapeHtml(raw);
    },
  },
});

/**
 * Turns shared free text into HTML for its chosen format: the limited Markdown display for
 * `formatted`, the ordinary chat-style decoration (which keeps legacy marks) for `normal`.
 */
export function decorateTextByFormat(text: string, format: TextFormat): string {
  return format === 'formatted' ? formatNoteText(text) : decorateChatStyleText(text);
}

/**
 * Turns a note's body into HTML for the "formatted" display.
 *
 * Reads headings, `-` and `1.` lists, `>` quotes and inline or fenced code; every other mark is
 * shown as typed. Line breaks are kept, and the ruby notation (`|word<reading>` or `|word《reading》`)
 * applies outside code. Should the parser fail, the text is shown the normal way instead.
 */
export function formatNoteText(text: string): string {
  try {
    return noteMarked.parse(text, { async: false });
  } catch {
    return decorateChatStyleText(text);
  }
}
