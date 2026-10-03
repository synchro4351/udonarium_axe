/* Decoration shared by chat and shared notes. Ruby is parsed from raw text, then every run
   is HTML-escaped before quotation styling is applied. Live chat and non-editing notes use
   the same rendering path. */

import { replaceRubyNotation, rubyNotationRuns } from '@axe/domain/chat/ruby-notation';

const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
  '&': '&amp;',
  "'": '&#x27;',
  '`': '&#x60;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
};

/**
 * Escapes the characters that could start markup or break an attribute, so text can be put
 * into HTML as it was typed. A value that is not a string is converted without escaping.
 */
export function escapeHtml(text: unknown): string {
  if (typeof text !== 'string') return String(text);
  return text.replace(/[&'`"<>]/g, (match) => HTML_ESCAPE_MAP[match] ?? match);
}

const ESCAPED_SPACE = /\\s/g;

/** Escapes text and turns `\s` into a space. */
function escapeRun(text: string): string {
  return escapeHtml(text).replace(ESCAPED_SPACE, ' ');
}

/**
 * Escapes text as {@link escapeHtml} does, turns the ruby notation (`|word<reading>` or
 * `|word《reading》`, with a half- or full-width bar) into `<ruby>` markup, and `\s` into a space.
 *
 * Takes the text as it was typed: the notation is read before anything is escaped, and the words
 * and the reading are escaped on their own, so markup typed into either stays text.
 */
export function escapeHtmlWithRuby(text: string): string {
  return replaceRubyNotation(
    text,
    (base, reading) => `<ruby class="chat-ruby"><rb>${escapeRun(base)}</rb><rt>${escapeRun(reading)}</rt></ruby>`,
    escapeRun
  );
}

/** A run of a line: plain text, or text with a reading written over it. */
export interface RubyPart {
  readonly text: string;
  /** Empty for plain text. */
  readonly reading: string;
}

/**
 * Cuts a line at the ruby notation, the same way {@link escapeHtmlWithRuby} reads it.
 *
 * The runs stay text rather than becoming html, for a place that shows a line a little at a time
 * and so cannot hand over a finished piece of markup.
 */
export function splitRubyNotation(text: string): RubyPart[] {
  return rubyNotationRuns(text).map((run) => ({
    text: run.text.replace(ESCAPED_SPACE, ' '),
    reading: run.reading.replace(ESCAPED_SPACE, ' '),
  }));
}

/** Whether the text holds any ruby notation, read the same way {@link escapeHtmlWithRuby} reads it. */
export function hasRubyNotation(text: string): boolean {
  return rubyNotationRuns(text).some((run) => run.reading !== '');
}

/**
 * Gathers each run of lines starting with `>` into one quote block, the lines joined by breaks.
 *
 * Expects escaped HTML, so it looks for the escaped `&gt;`.
 */
export function decorateQuoteLines(html: string): string {
  const lines = html.split('\n');
  const parts: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const match = /^&gt;\s?(.*)$/.exec(lines[i]);
    if (match) {
      const buffer: string[] = [match[1]];
      i++;
      while (i < lines.length) {
        const inner = /^&gt;\s?(.*)$/.exec(lines[i]);
        if (!inner) break;
        buffer.push(inner[1]);
        i++;
      }
      parts.push(`<span class="chat-quote">${buffer.join('<br>')}</span>`);
    } else {
      parts.push(lines[i]);
      i++;
    }
  }
  return parts.join('\n');
}

/** Escapes html and applies the ruby notation, then quoted lines (`> ...`) */
export function decorateChatStyleText(text: string): string {
  return decorateQuoteLines(escapeHtmlWithRuby(text));
}
