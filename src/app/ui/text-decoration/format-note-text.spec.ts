import { formatNoteText } from '@axe/ui/text-decoration/format-note-text';

const RUBY = '<ruby class="chat-ruby"><rb>漢字</rb><rt>かんじ</rt></ruby>';

/** The output with the line breaks between block elements taken out, for shorter expectations. */
function format(text: string): string {
  return formatNoteText(text).replace(/>\n/g, '>').trim();
}

describe('formatNoteText', () => {
  describe('headings', () => {
    it('reads one to three hashes followed by a space as a heading', () => {
      expect(format('# 大見出し')).toBe('<h1>大見出し</h1>');
      expect(format('## 中見出し')).toBe('<h2>中見出し</h2>');
      expect(format('### 小見出し')).toBe('<h3>小見出し</h3>');
    });

    it('leaves four or more hashes as text', () => {
      expect(format('#### 見出し')).toBe('<p>#### 見出し</p>');
    });

    it('needs the space after the hashes', () => {
      expect(format('#タグ')).toBe('<p>#タグ</p>');
      expect(format('#')).toBe('<p>#</p>');
    });

    it('leaves a hash in the middle of a line alone', () => {
      expect(format('第#1話')).toBe('<p>第#1話</p>');
    });
  });

  describe('lists', () => {
    it('reads "- " lines as a bulleted list', () => {
      expect(format('- 剣\n- 盾')).toBe('<ul><li>剣</li><li>盾</li></ul>');
    });

    it('reads "1. " lines as a numbered list', () => {
      expect(format('1. 起きる\n2. 戦う')).toBe('<ol><li>起きる</li><li>戦う</li></ol>');
    });

    it('keeps the starting number of a numbered list', () => {
      expect(format('3. 三番目')).toBe('<ol start="3"><li>三番目</li></ol>');
    });

    it('leaves "* " and "+ " bullets and "1)" numbers as text', () => {
      expect(format('* 星')).toBe('<p>* 星</p>');
      expect(format('+ 足す')).toBe('<p>+ 足す</p>');
      expect(format('1) 括弧')).toBe('<p>1) 括弧</p>');
    });

    it('ends the list at an ordinary line instead of folding it into the last item', () => {
      expect(format('- 項目\n普通の行')).toBe('<ul><li>項目</li></ul><p>普通の行</p>');
    });

    it('ends a "-" list at a "*" line, which stays text', () => {
      expect(format('- 項目\n* 星')).toBe('<ul><li>項目</li></ul><p>* 星</p>');
    });

    it('starts a list on the line after ordinary text, a numbered one only from 1', () => {
      expect(format('持ち物\n- 剣')).toBe('<p>持ち物</p><ul><li>剣</li></ul>');
      expect(format('手順\n1. 起きる')).toBe('<p>手順</p><ol><li>起きる</li></ol>');
      expect(format('手順\n2. 戦う')).toBe('<p>手順<br>2. 戦う</p>');
    });

    it('nests an indented item', () => {
      expect(format('- 親\n  - 子')).toBe('<ul><li>親<ul><li>子</li></ul></li></ul>');
    });

    it('does not turn a negative number or a subtraction into a list', () => {
      expect(format('-3')).toBe('<p>-3</p>');
      expect(format('HP-1')).toBe('<p>HP-1</p>');
    });
  });

  describe('quotes', () => {
    it('reads ">" lines as one quote', () => {
      expect(format('> 一行目\n> 二行目')).toBe('<blockquote><p>一行目<br>二行目</p></blockquote>');
    });

    it('ends the quote at the first line without ">"', () => {
      expect(format('> 引用\n地の文')).toBe('<blockquote><p>引用</p></blockquote><p>地の文</p>');
    });

    it('leaves ">" in the middle of a line as an escaped character', () => {
      expect(format('5 > 3')).toBe('<p>5 &gt; 3</p>');
    });
  });

  describe('code', () => {
    it('shows inline code literally, without ruby', () => {
      expect(format('`|漢字《かんじ》`')).toBe('<p><code>|漢字《かんじ》</code></p>');
    });

    it('escapes markup inside inline code', () => {
      expect(format('`<b>太字</b>`')).toBe('<p><code>&lt;b&gt;太字&lt;/b&gt;</code></p>');
    });

    it('shows a fenced block literally, with its marks and line breaks', () => {
      expect(format('```\n# 見出しではない\n- リストではない\n|漢字《かんじ》\n<script>x</script>\n```')).toBe(
        '<pre><code># 見出しではない\n- リストではない\n|漢字《かんじ》\n&lt;script&gt;x&lt;/script&gt;</code></pre>'
      );
    });

    it('drops the language name of a fenced block', () => {
      expect(format('```"><img src=x>\ncode\n```')).toBe('<pre><code>code</code></pre>');
    });

    it('does not treat an indented line as code', () => {
      expect(format('    字下げ')).toBe('<p>    字下げ</p>');
    });
  });

  describe('ordinary text', () => {
    it('keeps each line break', () => {
      expect(format('一行目\n二行目\n三行目')).toBe('<p>一行目<br>二行目<br>三行目</p>');
    });

    it('splits paragraphs at a blank line', () => {
      expect(format('段落一\n\n段落二')).toBe('<p>段落一</p><p>段落二</p>');
    });

    it('applies the ruby notation to text, headings and list items', () => {
      expect(format('|漢字《かんじ》')).toBe(`<p>${RUBY}</p>`);
      expect(format('# |漢字《かんじ》')).toBe(`<h1>${RUBY}</h1>`);
      expect(format('- ｜漢字《かんじ》')).toBe(
        '<ul><li><ruby class="chat-ruby"><rb>漢字</rb><rt>かんじ</rt></ruby></li></ul>'
      );
    });

    it('turns "\\s" into a space as the normal display does', () => {
      expect(format('a\\sb')).toBe('<p>a b</p>');
    });

    it('leaves asterisks and underscores as typed, so arithmetic and dice stay readable', () => {
      expect(format('2*3*4 = 24')).toBe('<p>2*3*4 = 24</p>');
      expect(format('**強調しない** と _斜体にしない_')).toBe('<p>**強調しない** と _斜体にしない_</p>');
      expect(format('2D6*2')).toBe('<p>2D6*2</p>');
    });

    it('leaves the table commands as typed', () => {
      expect(format('{HP}\n:HP-1\n&バフ')).toBe('<p>{HP}<br>:HP-1<br>&amp;バフ</p>');
    });

    it('shows an entity as typed rather than decoding it', () => {
      expect(format('&lt;')).toBe('<p>&amp;lt;</p>');
    });

    it('lets a backslash keep a mark as text', () => {
      expect(format('\\# 見出しにしない')).toBe('<p># 見出しにしない</p>');
    });

    it('leaves rules and tables as text', () => {
      expect(format('---')).toBe('<p>---</p>');
      expect(format('| a | b |\n| - | - |\n| 1 | 2 |')).toBe('<p>| a | b |<br>| - | - |<br>| 1 | 2 |</p>');
    });

    it('gives nothing for an empty note', () => {
      expect(format('')).toBe('');
    });
  });

  describe('safety', () => {
    it('escapes raw HTML in a block and inline', () => {
      expect(format('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
      expect(format('文中の<img src=x onerror=alert(1)>')).toBe('<p>文中の&lt;img src=x onerror=alert(1)&gt;</p>');
    });

    it('does not make links, images or automatic links', () => {
      const html = formatNoteText(
        [
          '[押す](javascript:alert(1))',
          '![画像](https://example.com/a.png)',
          '<https://example.com>',
          'https://example.com',
          'www.example.com',
          '[参照]: https://example.com',
          '[参照]',
        ].join('\n')
      );
      expect(html).not.toMatch(/<a[\s>]|<img|href=|src=/);
      expect(html).toContain('[押す](javascript:alert(1))');
      expect(html).toContain('https://example.com');
    });

    it('produces no tag outside the allowed set for a mixed input', () => {
      const html = formatNoteText(
        [
          '# 見出し <b>',
          '- 項目 <i onclick="x">',
          '> 引用 <svg onload=x>',
          '1. 番号 `<u>`',
          '```html',
          '<iframe src="https://example.com"></iframe>',
          '```',
          '<div onclick="x">ブロック</div>',
          '| 表 |',
          '**強調**',
          '- [x] 済み',
        ].join('\n')
      );
      const tags = [...html.matchAll(/<\/?([a-z0-9]+)/g)].map((match) => match[1]);
      const allowed = ['h1', 'h2', 'h3', 'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'ruby', 'rb', 'rt'];
      expect(tags.filter((tag) => !allowed.includes(tag))).toEqual([]);
      expect(html).not.toMatch(/\son[a-z]+="/);
    });
  });
});
