import { replaceRubyNotation, rubyNotationRuns } from '@axe/domain/chat/ruby-notation';

/** The text with each ruby written `[base/reading]`, to see at a glance what was read. */
function marked(text: string): string {
  return replaceRubyNotation(text, (base, reading) => `[${base}/${reading}]`);
}

/** The old reading of the double-bracket form, which it must keep to the letter. */
const OLD_NOTATION = /[|｜]([^|｜\s]+?)《(.+?)》/g;

describe('rubyNotationRuns()', () => {
  it('gives nothing for empty text and one plain run for text without ruby', () => {
    expect(rubyNotationRuns('')).toEqual([]);
    expect(rubyNotationRuns('こんにちは')).toEqual([{ raw: 'こんにちは', text: 'こんにちは', reading: '' }]);
  });

  it('cuts both forms out of the text around them, keeping what was typed', () => {
    expect(rubyNotationRuns('今日の|天気<てんき>は｜晴《は》れ')).toEqual([
      { raw: '今日の', text: '今日の', reading: '' },
      { raw: '|天気<てんき>', text: '天気', reading: 'てんき' },
      { raw: 'は', text: 'は', reading: '' },
      { raw: '｜晴《は》', text: '晴', reading: 'は' },
      { raw: 'れ', text: 'れ', reading: '' },
    ]);
  });
});

describe('replaceRubyNotation()', () => {
  describe('the angle-bracket form', () => {
    it('reads a base and a reading after a half- or full-width bar', () => {
      expect(marked('|漢字<かんじ>')).toBe('[漢字/かんじ]');
      expect(marked('｜漢字<かんじ>')).toBe('[漢字/かんじ]');
      expect(marked('|Tokyo<とうきょう> and |大阪<Osaka>')).toBe('[Tokyo/とうきょう] and [大阪/Osaka]');
    });

    it('reads letters beyond the basic plane and combining marks as they are', () => {
      expect(marked('|𠮷野家<よしのや>')).toBe('[𠮷野家/よしのや]');
      expect(marked('|か゚<ka>')).toBe('[か゚/ka]');
      expect(marked('|🍣<すし>')).toBe('[🍣/すし]');
    });

    it('keeps spaces inside the reading', () => {
      expect(marked('|東京<とう きょう>')).toBe('[東京/とう きょう]');
      expect(marked('|東京< とうきょう >')).toBe('[東京/ とうきょう ]');
    });

    it('needs the bar, a base and a reading, and the closing bracket', () => {
      expect(marked('漢字<かんじ>')).toBe('漢字<かんじ>');
      expect(marked('|<かんじ>')).toBe('|<かんじ>');
      expect(marked('|漢字<>')).toBe('|漢字<>');
      expect(marked('|漢字<   >')).toBe('|漢字<   >');
      expect(marked('|漢字<かんじ')).toBe('|漢字<かんじ');
      expect(marked('|漢字 <かんじ>')).toBe('|漢字 <かんじ>');
      expect(marked('| 漢字<かんじ>')).toBe('| 漢字<かんじ>');
    });

    it('does not read across a line break', () => {
      expect(marked('|漢字<かん\nじ>')).toBe('|漢字<かん\nじ>');
      expect(marked('|漢字<かん\r\nじ>')).toBe('|漢字<かん\r\nじ>');
      expect(marked('|漢\n字<かんじ>')).toBe('|漢\n字<かんじ>');
    });

    it('leaves comparisons, arithmetic and absolute values as text', () => {
      for (const text of [
        'a<b>c',
        '1 < 2 > 0',
        'HP<10>MP',
        '|x| < 3 > 1',
        '|x|<3>',
        '|a-b|<c>',
        '2d6<=8',
        'x || y<z>',
        '|<b>太字</b>',
        '<script>alert(1)</script>',
        'https://example.com/?q=a<b>',
        '<https://example.com>',
        '|a<b<c>',
      ]) {
        expect(marked(text)).toBe(text);
      }
    });

    it('reads one only where a bar says so', () => {
      expect(marked('x|y<br>')).toBe('x[y/br]');
      expect(marked('|a<b>c>')).toBe('[a/b]c>');
    });
  });

  describe('the double-bracket form', () => {
    it('reads exactly as before', () => {
      for (const text of [
        '|漢字《かんじ》',
        '｜熟語《じゅくご》',
        'a|漢字《かんじ》b',
        '|漢 字《かんじ》',
        '|漢字《》',
        '||漢字《かんじ》',
        '|a《b《c》',
        '|a<b>《c》',
        '｜<本文>《"ルビ"》',
        '|漢字《かん じ》',
        '|漢字《かん\nじ》',
        '|技《爆炎》《斬撃》',
        '一\\s二|三《さん》',
      ]) {
        expect(marked(text)).toBe(text.replace(OLD_NOTATION, '[$1/$2]'));
      }
    });

    it('is read first where both forms could start', () => {
      expect(marked('|a<b>《c》')).toBe('[a<b>/c]');
      expect(marked('|魔法<まほう>は《炎》')).toBe('[魔法<まほう>は/炎]');
      expect(marked('|魔法<まほう> 《炎》')).toBe('[魔法/まほう] 《炎》');
    });

    it('is not taken by an angle-bracket reading', () => {
      expect(marked('|a<x |b《c》 y>')).toBe('|a<x [b/c] y>');
    });
  });

  it('reads old and new forms side by side', () => {
    expect(marked('|魔法《まほう》と|呪文<じゅもん>と｜剣<つるぎ>')).toBe(
      '[魔法/まほう]と[呪文/じゅもん]と[剣/つるぎ]'
    );
  });

  it('passes the text between rubies to the plain rewrite', () => {
    expect(
      replaceRubyNotation(
        '<a>|b<c>&',
        (base, reading) => `{${base}:${reading}}`,
        (text) => text.toUpperCase()
      )
    ).toBe('<A>{b:c}&');
  });
});
