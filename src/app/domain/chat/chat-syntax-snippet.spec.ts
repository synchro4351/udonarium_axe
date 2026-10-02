import {
  applyChatSyntax,
  chatSyntaxExample,
  ChatSyntaxSnippet,
  chatSyntaxSnippets,
} from '@axe/domain/chat/chat-syntax-snippet';

const snippets = chatSyntaxSnippets({
  rubyBase: '漢字',
  rubyReading: 'かんじ',
  resource: 'HP',
  buffName: 'バフ名',
  effectName: '演出名',
});

function snippet(id: string): ChatSyntaxSnippet {
  return snippets.find((one) => one.id === id)!;
}

/** The text with the part to be picked out next in brackets. */
function applied(text: string, start: number, end: number, id: string): string {
  const edit = applyChatSyntax(text, start, end, snippet(id));
  return (
    edit.text.slice(0, edit.selectionStart) +
    '[' +
    edit.text.slice(edit.selectionStart, edit.selectionEnd) +
    ']' +
    edit.text.slice(edit.selectionEnd)
  );
}

describe('chatSyntaxSnippets', () => {
  it('writes each out as the chat reads it', () => {
    expect(snippets.map(chatSyntaxExample)).toEqual([
      '|漢字<かんじ>',
      'S2d6',
      '> ',
      ':HP-1',
      't:HP-1',
      '&バフ名/3',
      '{HP}',
      '@2',
      '《演出名》',
    ]);
  });
});

describe('applyChatSyntax', () => {
  describe('at the caret', () => {
    it('picks out the first placeholder when nothing was picked out', () => {
      expect(applied('ab', 1, 1, 'ruby')).toBe('a|[漢字]<かんじ>b');
      expect(applied('', 0, 0, 'effect')).toBe('《[演出名]》');
    });

    it('puts the words picked out in the first place, and picks out the second', () => {
      expect(applied('今日は晴天です', 3, 5, 'ruby')).toBe('今日は|晴天<[かんじ]>です');
      expect(applied('MP', 0, 2, 'resource')).toBe(':MP-[1]');
    });

    it('leaves the caret after it when the words picked out fill the only place', () => {
      expect(applied('HP', 0, 2, 'reference')).toBe('{HP}[]');
    });
  });

  describe('at the start of the line', () => {
    it('marks a written line, keeping what was picked out', () => {
      expect(applied('2d6', 3, 3, 'secretDice')).toBe('S2d6[]');
      expect(applied('one\nquoted', 6, 8, 'quote')).toBe('one\n> qu[ot]ed');
    });

    it('fills an empty line with the placeholder, picked out', () => {
      expect(applied('', 0, 0, 'secretDice')).toBe('S[2d6]');
      expect(applied('\nsecond', 0, 0, 'secretDice')).toBe('S[2d6]\nsecond');
      expect(applied('first\n', 6, 6, 'quote')).toBe('first\n> []');
    });

    it('leaves a line already marked as it was', () => {
      expect(applied('S2d6', 4, 4, 'secretDice')).toBe('S2d6[]');
    });
  });

  describe('at the end of the line', () => {
    it('adds it after a space, picking out the placeholder', () => {
      expect(applied('やったね', 1, 1, 'portrait')).toBe('やったね @[2]');
      expect(applied('one\ntwo', 1, 1, 'portrait')).toBe('one @[2]\ntwo');
    });

    it('adds no second space', () => {
      expect(applied('hi ', 0, 0, 'portrait')).toBe('hi @[2]');
      expect(applied('', 0, 0, 'portrait')).toBe('@[2]');
    });
  });
});
