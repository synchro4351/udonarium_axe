import { TestBed } from '@angular/core/testing';
import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import { ObjectStore } from '@axe/core/sync/object-store';
import { carriedImagesOf } from '@axe/domain/media/carried-images';
import {
  normalizeStampName,
  normalizeStampWords,
  parseStampItems,
  parseStampItemsStrict,
  serializeStampItems,
  STAMP_LIMITS,
  StampItem,
  StampPack,
} from '@axe/domain/media/stamp-pack';

function stamp(id: string, overrides: Partial<StampItem> = {}): StampItem {
  return { id, name: `stamp ${id}`, imageIdentifier: `image-${id}`, words: [], ...overrides };
}

describe('stamp pack', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  describe('normalizeStampName()', () => {
    it('keeps a name on one trimmed line', () => {
      expect(normalizeStampName('  good\n\tjob  ')).toBe('good job');
    });

    it('cuts a long name to the limit without splitting a character', () => {
      const name = normalizeStampName('😀'.repeat(STAMP_LIMITS.nameLength + 5));
      expect(Array.from(name)).toHaveLength(STAMP_LIMITS.nameLength);
    });

    it('reads anything but text as no name', () => {
      expect(normalizeStampName(42)).toBe('');
    });
  });

  describe('normalizeStampWords()', () => {
    it('splits typed text at spaces and commas, Japanese ones included', () => {
      expect(normalizeStampWords('いいね, ok、了解，yes  no')).toEqual(['いいね', 'ok', '了解', 'yes', 'no']);
    });

    it('drops the leading colon a word is typed with in chat', () => {
      expect(normalizeStampWords([':ok', '::yes'])).toEqual(['ok', 'yes']);
    });

    it('keeps a word once whatever its case', () => {
      expect(normalizeStampWords('OK ok Ok')).toEqual(['OK']);
    });

    it('keeps no more words than a stamp may have, each cut to length', () => {
      const words = normalizeStampWords(Array.from({ length: 30 }, (_, index) => `w${index}${'x'.repeat(40)}`));
      expect(words).toHaveLength(STAMP_LIMITS.wordsPerStamp);
      expect(words.every((word) => word.length <= STAMP_LIMITS.wordLength)).toBe(true);
    });
  });

  describe('parseStampItems()', () => {
    it('reads what it wrote', () => {
      const items = [stamp('a', { words: ['hi'] }), stamp('b')];
      expect(parseStampItems(serializeStampItems(items))).toEqual(items);
    });

    it('reads broken text as no stamps', () => {
      expect(parseStampItems('{not json')).toEqual([]);
      expect(parseStampItems('{"id":"a"}')).toEqual([]);
    });

    it('leaves out a stamp without an id or a picture, and a second one under an id', () => {
      const text = JSON.stringify([stamp('a'), { id: 'b' }, { imageIdentifier: 'x' }, stamp('a'), 'text']);
      expect(parseStampItems(text).map((item) => item.id)).toEqual(['a']);
    });

    it('keeps no more stamps than a pack may hold', () => {
      const many = Array.from({ length: STAMP_LIMITS.stampsPerPack + 3 }, (_, index) => stamp(`s${index}`));
      expect(parseStampItems(serializeStampItems(many))).toHaveLength(STAMP_LIMITS.stampsPerPack);
    });
  });

  describe('parseStampItemsStrict()', () => {
    it('reads a well-formed list', () => {
      expect(parseStampItemsStrict(serializeStampItems([stamp('a')]))).toEqual([stamp('a')]);
    });

    it('turns away the whole list over one bad stamp', () => {
      expect(parseStampItemsStrict(JSON.stringify([stamp('a'), { id: 'b' }]))).toBe('malformed');
      expect(parseStampItemsStrict(JSON.stringify([stamp('a'), stamp('a')]))).toBe('malformed');
      expect(parseStampItemsStrict(JSON.stringify([stamp('a', { name: '  ' })]))).toBe('malformed');
      expect(parseStampItemsStrict('nope')).toBe('malformed');
    });

    it('turns away more stamps than a pack may hold', () => {
      const many = Array.from({ length: STAMP_LIMITS.stampsPerPack + 1 }, (_, index) => stamp(`s${index}`));
      expect(parseStampItemsStrict(serializeStampItems(many))).toBe('tooManyStamps');
    });
  });

  describe('StampPack', () => {
    it('keeps its stamps through setItems and reads them back', () => {
      const pack = new StampPack();
      pack.setItems([stamp('a'), stamp('b')]);
      expect(pack.items.map((item) => item.id)).toEqual(['a', 'b']);
      expect(pack.itemOf('b')?.name).toBe('stamp b');
      expect(pack.itemOf('missing')).toBeNull();
    });

    it('says which pictures it carries, each once', () => {
      const pack = new StampPack();
      pack.setItems([stamp('a'), stamp('b', { imageIdentifier: 'image-a' }), stamp('c')]);
      expect(carriedImagesOf(pack)).toEqual(['image-a', 'image-c']);
    });

    it('comes back from its XML as the same pack', () => {
      const pack = new StampPack();
      pack.name = 'いつもの';
      pack.setItems([stamp('a', { words: ['ok', 'いいね'] })]);
      const xml = pack.toXml();

      const read = ObjectSerializer.instance.parseXml(xml) as StampPack;

      expect(read).toBeInstanceOf(StampPack);
      expect(read.identifier).toBe(pack.identifier);
      expect(read.name).toBe('いつもの');
      expect(read.items).toEqual(pack.items);
    });

    it('comes in beside a pack the room already has, as a copy', () => {
      const pack = new StampPack();
      pack.name = 'original';
      pack.initialize();

      const read = ObjectSerializer.instance.parseXml(pack.toXml()) as StampPack;

      expect(read.identifier).not.toBe(pack.identifier);
      expect(ObjectStore.instance.getObjects(StampPack)).toHaveLength(2);
    });
  });
});
