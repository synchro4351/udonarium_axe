/** A mark the note editor's buttons can put in, for the formatted display. */
export type TextNoteFormatMark = 'heading' | 'bullet' | 'numbered' | 'quote' | 'code';

/** The marks in the order the editor shows their buttons, with the icon for each. */
export const TEXT_NOTE_FORMAT_MARKS: readonly { mark: TextNoteFormatMark; icon: string }[] = [
  { mark: 'heading', icon: 'title' },
  { mark: 'bullet', icon: 'format_list_bulleted' },
  { mark: 'numbered', icon: 'format_list_numbered' },
  { mark: 'quote', icon: 'format_quote' },
  { mark: 'code', icon: 'code' },
];

const LINE_PREFIX: Readonly<Record<Exclude<TextNoteFormatMark, 'code'>, string>> = {
  heading: '## ',
  bullet: '- ',
  numbered: '1. ',
  quote: '> ',
};

/** A text with the selection to restore after a mark was put in. */
export interface TextNoteEdit {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

/**
 * Puts a formatting mark into a note's text at the selection.
 *
 * Line marks go at the start of every selected line that does not begin with them yet; a heading
 * is written as `## `. Code wraps the selection in backticks, or in a fenced block when it spans
 * lines, and an empty selection gets an empty pair with the caret between them.
 */
export function applyTextNoteFormatMark(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  mark: TextNoteFormatMark
): TextNoteEdit {
  const start = Math.max(0, Math.min(selectionStart, selectionEnd, text.length));
  const end = Math.min(text.length, Math.max(selectionStart, selectionEnd, start));
  if (mark === 'code') return wrapInCode(text, start, end);

  const prefix = LINE_PREFIX[mark];
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  // A selection of whole lines ends just past a line break; the line after it is not selected.
  const linesEnd = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const lines = text.slice(lineStart, linesEnd).split('\n');
  let added = 0;
  let addedBeforeStart = 0;
  const marked = lines.map((line, index) => {
    if (line.startsWith(prefix)) return line;
    added += prefix.length;
    if (index === 0) addedBeforeStart = prefix.length;
    return prefix + line;
  });
  return {
    text: text.slice(0, lineStart) + marked.join('\n') + text.slice(linesEnd),
    selectionStart: start + addedBeforeStart,
    selectionEnd: end + added,
  };
}

function wrapInCode(text: string, start: number, end: number): TextNoteEdit {
  const selected = text.slice(start, end);
  if (!selected.includes('\n')) {
    return {
      text: `${text.slice(0, start)}\`${selected}\`${text.slice(end)}`,
      selectionStart: start + 1,
      selectionEnd: end + 1,
    };
  }
  const before = start === 0 || text[start - 1] === '\n' ? '' : '\n';
  const after = end === text.length || text[end] === '\n' ? '' : '\n';
  const opening = `${before}\`\`\`\n`;
  return {
    text: `${text.slice(0, start)}${opening}${selected}\n\`\`\`${after}${text.slice(end)}`,
    selectionStart: start + opening.length,
    selectionEnd: end + opening.length,
  };
}
