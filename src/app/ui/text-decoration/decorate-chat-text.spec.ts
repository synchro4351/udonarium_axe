import {
  decorateChatStyleText,
  decorateQuoteLines,
  escapeHtml,
  escapeHtmlWithRuby,
  hasRubyNotation,
  splitRubyNotation,
} from '@axe/ui/text-decoration/decorate-chat-text';

describe('decorate-chat-text', () => {
  describe('hasRubyNotation', () => {
    it('is true for either notation and false for plain, math-like or unfinished text', () => {
      expect(hasRubyNotation('|漢字《かんじ》')).toBe(true);
      expect(hasRubyNotation('a |word<ruby> b')).toBe(true);
      expect(hasRubyNotation('1 <2 >0 2*3+4')).toBe(false);
      expect(hasRubyNotation('|a')).toBe(false);
      expect(hasRubyNotation('')).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('escapes the html special characters', () => {
      expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    });

    it('turns a non-string into text', () => {
      expect(escapeHtml(42)).toBe('42');
      expect(escapeHtml(null)).toBe('null');
    });
  });

  describe('escapeHtmlWithRuby', () => {
    it('turns the ruby notation into a ruby element', () => {
      const result = escapeHtmlWithRuby('|漢字《かんじ》');
      expect(result).toBe('<ruby class="chat-ruby"><rb>漢字</rb><rt>かんじ</rt></ruby>');
    });

    it('accepts the full-width pipe too', () => {
      const result = escapeHtmlWithRuby('｜熟語《じゅくご》');
      expect(result).toBe('<ruby class="chat-ruby"><rb>熟語</rb><rt>じゅくご</rt></ruby>');
    });

    it('reads the angle-bracket form beside the double-bracket one', () => {
      expect(escapeHtmlWithRuby('|漢字<かんじ>と｜熟語《じゅくご》')).toBe(
        '<ruby class="chat-ruby"><rb>漢字</rb><rt>かんじ</rt></ruby>と' +
          '<ruby class="chat-ruby"><rb>熟語</rb><rt>じゅくご</rt></ruby>'
      );
    });

    it('escapes the words and the reading once each, so markup and entities stay text', () => {
      expect(escapeHtmlWithRuby('|&amp;<"x">')).toBe(
        '<ruby class="chat-ruby"><rb>&amp;amp;</rb><rt>&quot;x&quot;</rt></ruby>'
      );
      expect(escapeHtmlWithRuby('|a<script>alert(1)</script>')).toBe(
        '<ruby class="chat-ruby"><rb>a</rb><rt>script</rt></ruby>alert(1)&lt;/script&gt;'
      );
      expect(escapeHtmlWithRuby('｜<b>《<i>》')).toBe(
        '<ruby class="chat-ruby"><rb>&lt;b&gt;</rb><rt>&lt;i&gt;</rt></ruby>'
      );
    });

    it('does not read escaped angle brackets typed as entities', () => {
      expect(escapeHtmlWithRuby('|漢字&lt;かんじ&gt;')).toBe('|漢字&amp;lt;かんじ&amp;gt;');
    });

    it('leaves comparisons and markup without a ruby bar as escaped text', () => {
      expect(escapeHtmlWithRuby('a<b>c |x|<3> <img src=x onerror=alert(1)>')).toBe(
        'a&lt;b&gt;c |x|&lt;3&gt; &lt;img src=x onerror=alert(1)&gt;'
      );
    });

    it('turns "\\s" into a space inside and outside the ruby', () => {
      expect(escapeHtmlWithRuby('一\\s|二\\s三<に\\sさん>')).toBe(
        '一 <ruby class="chat-ruby"><rb>二 三</rb><rt>に さん</rt></ruby>'
      );
    });
  });

  describe('splitRubyNotation', () => {
    it('gives nothing for an empty line', () => {
      expect(splitRubyNotation('')).toEqual([]);
    });

    it('keeps a line with no notation as one plain run', () => {
      expect(splitRubyNotation('こんにちは')).toEqual([{ text: 'こんにちは', reading: '' }]);
    });

    it('cuts the words with a reading out of the text around them', () => {
      expect(splitRubyNotation('今日の|天気《てんき》は｜晴《は》れ')).toEqual([
        { text: '今日の', reading: '' },
        { text: '天気', reading: 'てんき' },
        { text: 'は', reading: '' },
        { text: '晴', reading: 'は' },
        { text: 'れ', reading: '' },
      ]);
    });

    it('cuts out the angle-bracket form too, so a line typed out gets its reading', () => {
      expect(splitRubyNotation('|天気<てんき>は 《晴れ》')).toEqual([
        { text: '天気', reading: 'てんき' },
        { text: 'は 《晴れ》', reading: '' },
      ]);
    });

    it('leaves the text as it is written rather than escaping it', () => {
      expect(splitRubyNotation('<b>|&《アンド》')).toEqual([
        { text: '<b>', reading: '' },
        { text: '&', reading: 'アンド' },
      ]);
    });

    it('reads the notation where the chat does', () => {
      for (const line of [
        'a|漢字《かんじ》b',
        '|漢 字《かんじ》',
        '|漢字《》',
        '||漢字《かんじ》',
        '一\\s二|三《さん》',
        '|漢字<かんじ>と|熟語《じゅくご》',
      ]) {
        const html = splitRubyNotation(line)
          .map((part) =>
            part.reading.length > 0
              ? `<ruby class="chat-ruby"><rb>${part.text}</rb><rt>${part.reading}</rt></ruby>`
              : part.text
          )
          .join('');
        expect(html).toBe(escapeHtmlWithRuby(line));
      }
    });
  });

  describe('decorateQuoteLines', () => {
    it('wraps a line beginning with an angle bracket in a quote element', () => {
      expect(decorateQuoteLines('hello\n&gt; quoted\nworld')).toBe(
        'hello\n<span class="chat-quote">quoted</span>\nworld'
      );
    });

    it('gathers consecutive quoted lines into one quote', () => {
      expect(decorateQuoteLines('&gt; line 1\n&gt; line 2')).toBe('<span class="chat-quote">line 1<br>line 2</span>');
    });

    it('leaves text with no quote marker alone', () => {
      expect(decorateQuoteLines('plain text')).toBe('plain text');
    });
  });

  describe('decorateChatStyleText, all of it at once', () => {
    it('escapes, then rubies, then quotes', () => {
      const input = '> @勇者\n> こんにちは|世界《せかい》';
      const result = decorateChatStyleText(input);
      expect(result).toContain('<span class="chat-quote">');
      expect(result).toContain('@勇者');
      expect(result).toContain('<ruby class="chat-ruby"><rb>世界</rb><rt>せかい</rt></ruby>');
    });

    it('escapes html-looking input inside a quote before decorating it', () => {
      const result = decorateChatStyleText('> <b>not bold</b>');
      expect(result).toBe('<span class="chat-quote">&lt;b&gt;not bold&lt;/b&gt;</span>');
    });

    it('quotes a line holding the angle-bracket ruby', () => {
      expect(decorateChatStyleText('> |世界<せかい>\n|a<b>')).toBe(
        '<span class="chat-quote"><ruby class="chat-ruby"><rb>世界</rb><rt>せかい</rt></ruby></span>\n' +
          '<ruby class="chat-ruby"><rb>a</rb><rt>b</rt></ruby>'
      );
    });
  });
});
