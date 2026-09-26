import { StampItem } from '@axe/domain/media/stamp-pack';
import {
  MAX_STAMP_SUGGESTIONS,
  removeStampQuery,
  stampQueryAt,
  StampSuggestionPack,
  suggestStamps,
} from '@axe/domain/media/stamp-suggestion';

function item(id: string, name: string, words: string[]): StampItem {
  return { id, name, imageIdentifier: `image-${id}`, words };
}

function pack(identifier: string, name: string, items: StampItem[]): StampSuggestionPack {
  return { identifier, name, items };
}

describe('stampQueryAt', () => {
  const at = (text: string, caret = text.length) => stampQueryAt(text, caret);

  it('finds a colon word that opens the line or follows a space', () => {
    expect(at(':ok')).toEqual({ word: 'ok', start: 0, end: 3 });
    expect(at('well :good')).toEqual({ word: 'good', start: 5, end: 10 });
    expect(at('line\n:good')?.word).toBe('good');
  });

  it('takes the full-width colon a Japanese keyboard types', () => {
    expect(at('：やったね')?.word).toBe('やったね');
  });

  it('leaves a colon inside a word, a time, a link or a dice command alone', () => {
    expect(at('note:ok')).toBeNull();
    expect(at('12:30')).toBeNull();
    expect(at('https://example.com')).toBeNull();
    expect(at('2d6:1')).toBeNull();
  });

  it('wants at least one letter after the colon, and none of spaces', () => {
    expect(at(':')).toBeNull();
    expect(at('hello :')).toBeNull();
    expect(at(':good ')).toBeNull();
  });

  it('counts only while the caret stands at the end of the word', () => {
    expect(at(':good', 3)).toBeNull();
    expect(at(':good more', 5)?.word).toBe('good');
    expect(at(':good', 0)).toBeNull();
  });
});

describe('suggestStamps', () => {
  const smile = item('s1', 'Smile', ['smile', 'happy']);
  const smirk = item('s2', 'Smirk', ['smirk']);
  const nod = item('s3', 'Nod', ['ok', 'yes']);

  it('offers stamps whose saved words start with the word typed, in any case', () => {
    const found = suggestStamps([pack('p', 'Faces', [smile, smirk, nod])], 'SM');

    expect(found.map((one) => one.item.id)).toEqual(['s1', 's2']);
    expect(found[0].word).toBe('smile');
  });

  it('matches only the saved words, not the stamp name', () => {
    expect(suggestStamps([pack('p', 'Faces', [nod])], 'nod')).toEqual([]);
  });

  it('puts a stamp saved under the word itself before those it only starts', () => {
    const okay = item('a', 'Okay', ['okay']);
    const found = suggestStamps([pack('p', 'Faces', [okay, nod])], 'ok');

    expect(found.map((one) => one.item.id)).toEqual(['s3', 'a']);
  });

  it('offers a stamp once, under the word that fits best', () => {
    const many = item('m', 'Many', ['happy', 'hap', 'happiness']);
    const found = suggestStamps([pack('p', 'Faces', [many])], 'hap');

    expect(found).toHaveLength(1);
    expect(found[0].word).toBe('hap');
  });

  it('names the pack only when another pack offers a stamp by the same word or name', () => {
    const otherSmile = item('o1', 'Grin', ['smile']);
    const found = suggestStamps([pack('a', 'Faces', [smile, smirk]), pack('b', 'Animals', [otherSmile])], 'smi');

    const byId = new Map(found.map((one) => [one.item.id, one]));
    expect(byId.get('s1')?.showsPack).toBe(true);
    expect(byId.get('o1')?.showsPack).toBe(true);
    expect(byId.get('o1')?.packName).toBe('Animals');
    expect(byId.get('s2')?.showsPack).toBe(false);
  });

  it('does not name the pack when the same word comes twice from one pack', () => {
    const again = item('s9', 'Smile again', ['smile']);
    const found = suggestStamps([pack('a', 'Faces', [smile, again])], 'smile');

    expect(found.every((one) => !one.showsPack)).toBe(true);
  });

  it('offers no more than a short list, and nothing for no word', () => {
    const lots = Array.from({ length: 20 }, (_, index) => item(`x${index}`, `X${index}`, ['go']));

    expect(suggestStamps([pack('p', 'Lots', lots)], 'go')).toHaveLength(MAX_STAMP_SUGGESTIONS);
    expect(suggestStamps([pack('p', 'Lots', lots)], '')).toEqual([]);
  });
});

describe('removeStampQuery', () => {
  function remove(text: string, caret: number) {
    return removeStampQuery(text, stampQueryAt(text, caret)!);
  }

  it('takes the word out with the space it leaves doubled', () => {
    expect(remove('see :ok you', 7)).toEqual({ text: 'see you', caret: 3 });
  });

  it('takes a trailing word out with the space before it', () => {
    expect(remove('nice :ok', 8)).toEqual({ text: 'nice', caret: 4 });
  });

  it('takes a leading word out with the space after it', () => {
    expect(remove(':ok then', 3)).toEqual({ text: 'then', caret: 0 });
  });

  it('empties a line that held nothing else', () => {
    expect(remove(':ok', 3)).toEqual({ text: '', caret: 0 });
  });
});
