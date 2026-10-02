import { applyTextNoteFormatMark } from '@axe/features/tabletop/text-note/text-note-format-marks';

describe('applyTextNoteFormatMark', () => {
  describe('line marks', () => {
    it('puts a bullet at the start of the line holding the caret', () => {
      expect(applyTextNoteFormatMark('剣\n盾', 3, 3, 'bullet')).toEqual({
        text: '剣\n- 盾',
        selectionStart: 5,
        selectionEnd: 5,
      });
    });

    it('writes a heading as "## "', () => {
      expect(applyTextNoteFormatMark('見出し', 0, 0, 'heading').text).toBe('## 見出し');
    });

    it('marks every selected line, numbering them all "1. "', () => {
      expect(applyTextNoteFormatMark('a\nb\nc', 0, 5, 'numbered')).toEqual({
        text: '1. a\n1. b\n1. c',
        selectionStart: 3,
        selectionEnd: 14,
      });
    });

    it('leaves a line that already has the mark', () => {
      expect(applyTextNoteFormatMark('> a\nb', 0, 5, 'quote').text).toBe('> a\n> b');
    });

    it('does not mark the line after a selection that ends at a line break', () => {
      expect(applyTextNoteFormatMark('a\nb\nc', 0, 4, 'bullet').text).toBe('- a\n- b\nc');
    });

    it('marks an empty note', () => {
      expect(applyTextNoteFormatMark('', 0, 0, 'bullet')).toEqual({ text: '- ', selectionStart: 2, selectionEnd: 2 });
    });
  });

  describe('code', () => {
    it('wraps a selection within one line in backticks', () => {
      expect(applyTextNoteFormatMark('x 1D6 y', 2, 5, 'code')).toEqual({
        text: 'x `1D6` y',
        selectionStart: 3,
        selectionEnd: 6,
      });
    });

    it('puts an empty pair at the caret', () => {
      expect(applyTextNoteFormatMark('ab', 1, 1, 'code')).toEqual({ text: 'a``b', selectionStart: 2, selectionEnd: 2 });
    });

    it('fences a selection over several lines, on lines of their own', () => {
      expect(applyTextNoteFormatMark('前a\nb後', 1, 4, 'code')).toEqual({
        text: '前\n```\na\nb\n```\n後',
        selectionStart: 6,
        selectionEnd: 9,
      });
    });
  });

  it('takes a selection made backwards', () => {
    expect(applyTextNoteFormatMark('x 1D6 y', 5, 2, 'code').text).toBe('x `1D6` y');
  });
});
