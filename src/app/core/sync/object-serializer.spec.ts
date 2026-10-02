import { TestBed } from '@angular/core/testing';
import { GameObject } from '@axe/core/sync/game-object';
import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import { GameCharacter } from '@axe/domain/character/game-character';
import { DataElement } from '@axe/domain/data/data-element';
import { CutInLayer } from '@axe/domain/media/cut-in-layer';

describe('ObjectSerializer', () => {
  let serializer: ObjectSerializer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    serializer = ObjectSerializer.instance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('instance', () => {
    it('returns the one instance', () => {
      const instance1 = ObjectSerializer.instance;
      const instance2 = ObjectSerializer.instance;
      expect(instance1).toBe(instance2);
    });
  });

  describe('toXml()', () => {
    it('turns an object into an xml string', () => {
      const element = DataElement.create('test', 'value', {});
      const xml = serializer.toXml(element);

      expect(typeof xml).toBe('string');
      expect(xml).toContain('data');
      expect(xml.startsWith('<')).toBe(true);
    });

    it('writes the attributes into the xml', () => {
      const element = DataElement.create('name', 'hello', { type: 'text' });
      const xml = serializer.toXml(element);

      expect(xml).toContain('name');
    });

    it('encodes the special characters', () => {
      const element = DataElement.create('test', 'a&b<c>"d', {});
      const xml = serializer.toXml(element);

      expect(xml).not.toContain('&b');
      expect(xml).toContain('&amp;');
    });
  });

  describe('parseXml()', () => {
    it('builds an object back from an xml string', () => {
      const element = DataElement.create('test', 'value', {});
      const xml = serializer.toXml(element);

      const parsed = serializer.parseXml(xml);
      expect(parsed).toBeTruthy();
      expect(parsed).toBeInstanceOf(GameObject);
    });

    it('gives the restored object the same alias', () => {
      const element = DataElement.create('test', 'value', {});
      const xml = serializer.toXml(element);

      const parsed = serializer.parseXml(xml);
      expect(parsed?.aliasName).toBe(element.aliasName);
    });

    it('returns nothing for broken xml', () => {
      const parsed = serializer.parseXml('<unclosed');
      expect(parsed).toBeFalsy();
    });

    it('returns nothing for an empty string', () => {
      const parsed = serializer.parseXml('');
      expect(parsed).toBeFalsy();
    });

    it('returns nothing for a tag it does not know', () => {
      const parsed = serializer.parseXml('<unknownTag />');
      expect(parsed).toBeFalsy();
    });
  });

  describe('toAttributes()', () => {
    it('turns flat sync data into attributes', () => {
      const syncData = { name: 'test', value: 42 };
      const attrs = ObjectSerializer.toAttributes(syncData);

      expect(attrs['name']).toBe('test');
      expect(attrs['value']).toBe(42);
    });

    it('writes a nested object in dotted notation', () => {
      const syncData = { location: { x: 10, y: 20 } };
      const attrs = ObjectSerializer.toAttributes(syncData);

      expect(attrs['location.x']).toBe(10);
      expect(attrs['location.y']).toBe(20);
    });

    it('writes an array in dotted notation with indices', () => {
      const syncData = { items: ['a', 'b', 'c'] };
      const attrs = ObjectSerializer.toAttributes(syncData);

      expect(attrs['items.0']).toBe('a');
      expect(attrs['items.1']).toBe('b');
      expect(attrs['items.2']).toBe('c');
    });

    it('returns nothing for empty sync data', () => {
      const attrs = ObjectSerializer.toAttributes({});
      expect(Object.keys(attrs)).toHaveLength(0);
    });

    it('leaves an undefined nested value out rather than writing it as the word', () => {
      const syncData = { location: { name: 'table', x: 10, y: 20, surface: undefined } };
      const attrs = ObjectSerializer.toAttributes(syncData);

      expect(attrs['location.x']).toBe(10);
      expect(Object.keys(attrs)).not.toContain('location.surface');
    });

    it('leaves out a value that came back from a peer as nothing, which arrives as null', () => {
      const syncData = { location: { name: 'table', x: 10, y: 20, surface: null } };
      const attrs = ObjectSerializer.toAttributes(syncData);

      expect(attrs['location.x']).toBe(10);
      expect(Object.keys(attrs)).not.toContain('location.surface');
    });
  });

  describe('undefined attributes in the xml', () => {
    function xmlWithSurface(surface: unknown): string {
      const piece = GameCharacter.create('コマ', 1, '');
      (piece.location as unknown as Record<string, unknown>)['surface'] = surface;
      try {
        return serializer.toXml(piece);
      } finally {
        piece.destroy();
      }
    }

    it('never writes an undefined surface as the word undefined', () => {
      expect(xmlWithSurface(undefined)).not.toContain('surface="undefined"');
    });

    it('never writes a surface that came back as null as the word null', () => {
      expect(xmlWithSurface(null)).not.toContain('surface="null"');
    });
  });

  describe('an attribute a number or a flag cannot be read from', () => {
    function parsed(xml: string): Record<string, unknown> {
      const element = new DOMParser().parseFromString(xml, 'text/xml').documentElement;
      const syncData: Record<string, unknown> = { count: 7, ready: true, name: 'kept' };
      ObjectSerializer.parseAttributes(syncData, element.attributes);
      return syncData;
    }

    it('leaves the field at what it already held, rather than failing the whole object', () => {
      expect(parsed('<node count="" ready="" name="" />')).toEqual({ count: 7, ready: true, name: '' });
    });

    it('still reads everything the attribute does say', () => {
      expect(parsed('<node count="3" ready="false" name="written" />')).toEqual({
        count: 3,
        ready: false,
        name: 'written',
      });
    });

    it('passes over a word where a number was written down', () => {
      expect(parsed('<node count="many" />').count).toBe(7);
    });
  });

  describe('the xml round trip', () => {
    it('writing a data element out and reading it back', () => {
      const original = DataElement.create('testName', 'testValue', {}, 'round-trip-id');
      const xml = serializer.toXml(original);
      const restored = serializer.parseXml(xml) as DataElement;

      expect(restored).toBeTruthy();
      expect(restored.aliasName).toBe(original.aliasName);
    });
  });

  describe('tabs and line breaks in an attribute', () => {
    function roundTrip(value: string): string {
      const original = DataElement.create('note', '', { memo: value });
      const restored = serializer.parseXml(serializer.toXml(original)) as DataElement;
      try {
        return restored.getAttribute('memo');
      } finally {
        original.destroy();
        restored.destroy();
      }
    }

    it('writes them as character references rather than as they are', () => {
      const xml = serializer.toXml(DataElement.create('note', '', { memo: 'a\r\nb\tc\nd\re' }));

      expect(xml).toContain('memo="a&#13;&#10;b&#9;c&#10;d&#13;e"');
      expect(xml).not.toMatch(/[\t\n\r]/);
    });

    it('leaves an ordinary attribute exactly as it was written before', () => {
      const xml = serializer.toXml(DataElement.create('HP', 10, { type: 'numberResource', currentValue: 8 }));

      expect(xml).toContain('type="numberResource"');
      expect(xml).toContain('currentValue="8"');
      expect(xml).toContain('name="HP"');
      expect(xml).not.toContain('&#');
    });

    it('leaves the line breaks in the element body as they are', () => {
      const xml = serializer.toXml(DataElement.create('note', 'first\nsecond\tthird', {}));

      expect(xml).toContain('>first\nsecond\tthird</data>');
    });

    it.each([
      ['a line feed', 'first\nsecond'],
      ['a carriage return', 'first\rsecond'],
      ['a CRLF', 'first\r\nsecond'],
      ['a tab', 'first\tsecond'],
      ['breaks at both ends', '\n\tmiddle\r\n'],
      ['quotes and ampersands', `say "hi" & 'bye' <now>`],
      ['Unicode', '日本語の台詞🎲\n二行目'],
    ])('reads %s back as it was written', (_label, value) => {
      expect(roundTrip(value)).toBe(value);
    });

    it('reads a line break in an older save as the space it always became', () => {
      const restored = serializer.parseXml('<data name="note" memo="first\nsecond"></data>') as DataElement;

      expect(restored.getAttribute('memo')).toBe('first second');
      restored.destroy();
    });
  });

  describe('a cut-in text layer', () => {
    it('keeps the lines of its words through a clone', () => {
      const layer = new CutInLayer();
      layer.initialize();
      layer.kind = 'text';
      layer.text = '一行目\n二行目\r\nthird\tline';

      const copy = layer.clone();

      expect(copy).not.toBe(layer);
      expect(copy.kind).toBe('text');
      expect(copy.text).toBe('一行目\n二行目\r\nthird\tline');
      layer.destroy();
      copy.destroy();
    });

    it('reads a single-line layer saved before the change as it always did', () => {
      const layer = serializer.parseXml(
        '<cut-in-layer name="title" kind="text" text="決戦 &amp; &quot;開幕&quot;" fontSizePx="48" vertical="true">' +
          '</cut-in-layer>'
      ) as CutInLayer;

      expect(layer).toBeInstanceOf(CutInLayer);
      expect(layer.name).toBe('title');
      expect(layer.text).toBe('決戦 & "開幕"');
      expect(layer.fontSizePx).toBe(48);
      expect(layer.vertical).toBe(true);
      layer.destroy();
    });
  });
});
