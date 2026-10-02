import {
  MAX_OVERHEAD_SPEECH_CHARS,
  overheadSpeechHoldMs,
  overheadSpeechOf,
  quotedSegmentsOf,
} from '@axe/domain/chat/overhead-speech';

function line(text: string, extra: { stampName?: string; images?: string[] } = {}) {
  return { text, stampName: extra.stampName, attachmentImageIdentifierList: extra.images ?? [] };
}

describe('quotedSegmentsOf()', () => {
  it('takes the inside of each kind of quotation mark, in order', () => {
    expect(quotedSegmentsOf('彼は「行くぞ」と言い、“Go!” then "now"')).toEqual(['行くぞ', 'Go!', 'now']);
  });

  it('never returns the unquoted narration around the quotes', () => {
    expect(quotedSegmentsOf('扉を開けた。「誰かいる？」静かだ。')).toEqual(['誰かいる？']);
    expect(quotedSegmentsOf('扉を開けた。静かだ。')).toEqual([]);
  });

  it('ignores unclosed and empty quotes', () => {
    expect(quotedSegmentsOf('「閉じていない')).toEqual([]);
    expect(quotedSegmentsOf('「 」 "" “”')).toEqual([]);
    expect(quotedSegmentsOf('a "b')).toEqual([]);
  });

  it('shows the base of ruby notation rather than its markup', () => {
    expect(quotedSegmentsOf('「|魔法《まほう》だ」')).toEqual(['魔法だ']);
    expect(quotedSegmentsOf('「|魔法<まほう>だ」')).toEqual(['魔法だ']);
  });

  it('does not pair straight quotes across lines', () => {
    expect(quotedSegmentsOf('say "a\nb" here')).toEqual([]);
  });

  it('answers nothing for missing text', () => {
    expect(quotedSegmentsOf(null)).toEqual([]);
    expect(quotedSegmentsOf(undefined)).toEqual([]);
  });
});

describe('overheadSpeechOf()', () => {
  it('shows only the quoted part of an ordinary line, one quotation to a row', () => {
    expect(overheadSpeechOf(line('剣を抜く。「来い！」「覚悟しろ」'))).toEqual({
      kind: 'text',
      text: '来い！\n覚悟しろ',
    });
  });

  it('shows nothing for an ordinary line without quotes', () => {
    expect(overheadSpeechOf(line('I attack the goblin.'))).toBeNull();
    expect(overheadSpeechOf(line(''))).toBeNull();
  });

  it('shows the picture of a stamp by its first attachment', () => {
    expect(overheadSpeechOf(line('', { stampName: 'いいね', images: ['img-1', 'img-2'] }))).toEqual({
      kind: 'stamp',
      imageIdentifier: 'img-1',
      name: 'いいね',
    });
  });

  it('shows nothing for a stamp without a picture', () => {
    expect(overheadSpeechOf(line('', { stampName: 'いいね' }))).toBeNull();
  });

  it('shows an emoji-only line as it is', () => {
    expect(overheadSpeechOf(line(' 😀 👍 '))).toEqual({ kind: 'emoji', text: '😀 👍' });
  });

  it('treats a line of emoji mixed with words as an ordinary line', () => {
    expect(overheadSpeechOf(line('ok 👍'))).toBeNull();
    expect(overheadSpeechOf(line('ok 「👍」'))).toEqual({ kind: 'text', text: '👍' });
  });

  it('cuts a long quotation short', () => {
    const long = 'あ'.repeat(MAX_OVERHEAD_SPEECH_CHARS + 20);
    const speech = overheadSpeechOf(line(`「${long}」`));
    expect(speech?.kind).toBe('text');
    const text = speech?.kind === 'text' ? speech.text : '';
    expect(Array.from(text)).toHaveLength(MAX_OVERHEAD_SPEECH_CHARS);
    expect(text.endsWith('…')).toBe(true);
  });
});

describe('overheadSpeechHoldMs()', () => {
  it('keeps pictures briefly and longer words longer, within a short bound', () => {
    expect(overheadSpeechHoldMs({ kind: 'stamp', imageIdentifier: 'a', name: 'b' })).toBe(4000);
    expect(overheadSpeechHoldMs({ kind: 'emoji', text: '😀' })).toBe(4000);
    const short = overheadSpeechHoldMs({ kind: 'text', text: 'はい' });
    const long = overheadSpeechHoldMs({ kind: 'text', text: 'あ'.repeat(80) });
    expect(short).toBeGreaterThanOrEqual(3000);
    expect(long).toBeGreaterThan(short);
    expect(long).toBeLessThanOrEqual(9000);
  });
});
