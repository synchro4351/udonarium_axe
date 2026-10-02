import { TestBed } from '@angular/core/testing';
import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import { ObjectStore } from '@axe/core/sync/object-store';
import { TextNote, TextNoteFormat, toTextNoteFormat } from '@axe/domain/tabletop/text-note';

describe('TextNote', () => {
  let store: ObjectStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = ObjectStore.instance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create()', () => {
    it('is created with a title and a body', () => {
      const note = TextNote.create('メモ', 'テスト内容');
      expect(note).toBeTruthy();
      expect(note.title).toBe('メモ');
      expect(note.text).toBe('テスト内容');
    });

    it('starts at the default type size', () => {
      const note = TextNote.create('t', 'text');
      expect(note.fontSize).toBe(16);
    });

    it('takes a type size', () => {
      const note = TextNote.create('t', 'text', 24);
      expect(note.fontSize).toBe(24);
    });

    it('takes a size of its own', () => {
      const note = TextNote.create('t', 'text', 16, 3, 4);
      expect(note.width).toBe(3);
      expect(note.height).toBe(4);
    });

    it('is created against an identifier of its own', () => {
      const note = TextNote.create('t', 'text', 16, 1, 1, 'note-id');
      expect(note.identifier).toBe('note-id');
    });

    it('is added to the store', () => {
      const note = TextNote.create('t', 'text');
      expect(store.get(note.identifier)).toBe(note);
    });

    it('starts one cell either way', () => {
      const note = TextNote.create('t', 'text');
      expect(note.width).toBe(1);
      expect(note.height).toBe(1);
    });
  });

  describe('aliasName', () => {
    it('names itself a note', () => {
      const note = TextNote.create('t', 'text');
      expect(note.aliasName).toBe('text-note');
    });
  });

  describe('the defaults of the synchronised fields', () => {
    it('starts unlocked', () => {
      const note = TextNote.create('t', 'text');
      expect(note.isLock).toBe(false);
    });

    it('starts unturned', () => {
      const note = TextNote.create('t', 'text');
      expect(note.rotate).toBe(0);
    });

    it('starts at the bottom of the stack', () => {
      const note = TextNote.create('t', 'text');
      expect(note.zindex).toBe(0);
    });

    it('starts without a password', () => {
      const note = TextNote.create('t', 'text');
      expect(note.password).toBe('');
    });

    it('starts standing up', () => {
      const note = TextNote.create('t', 'text');
      expect(note.isUpright).toBe(true);
    });

    it('starts unlimited in height', () => {
      const note = TextNote.create('t', 'text');
      expect(note.limitHeight).toBe(false);
    });
  });

  describe('display format', () => {
    it('starts normal, so a note looks as it did unless someone chooses otherwise', () => {
      const note = TextNote.create('t', 'text');
      expect(note.textFormat).toBe('normal');
      expect(note.format).toBe('normal');
    });

    it('takes the formatted display', () => {
      const note = TextNote.create('t', 'text');
      note.format = 'formatted';
      expect(note.textFormat).toBe('formatted');
      expect(note.format).toBe('formatted');
    });

    it.each(['markdown', '', 'FORMATTED', 'normal '])('reads an unknown stored value %j as normal', (stored) => {
      const note = TextNote.create('t', 'text');
      note.textFormat = stored;
      expect(note.format).toBe('normal');
    });

    it('reads a value that is not text as normal', () => {
      const note = TextNote.create('t', 'text');
      (note as unknown as { textFormat: unknown }).textFormat = 1;
      expect(note.format).toBe('normal');
    });

    it('stores only a known format', () => {
      const note = TextNote.create('t', 'text');
      note.format = 'markdown' as TextNoteFormat;
      expect(note.textFormat).toBe('normal');
    });

    it('reads a peer that does not know the setting as normal', () => {
      const note = TextNote.create('t', 'text');
      note.format = 'formatted';
      const context = note.toContext();
      delete (context.syncData as { attributes: Record<string, unknown> }).attributes['textFormat'];
      note.apply(context);
      expect(note.textFormat).toBe('');
      expect(note.format).toBe('normal');
    });

    it('is written into the saved note', () => {
      const note = TextNote.create('t', 'text');
      note.format = 'formatted';
      expect(ObjectSerializer.instance.toXml(note)).toContain('textFormat="formatted"');
    });

    it('is read back from a save, and an older save without it stays normal', () => {
      const read = (xml: string) => {
        const note = TextNote.create('t', 'text');
        note.parseAttributes(new DOMParser().parseFromString(xml, 'application/xml').documentElement.attributes);
        return note.format;
      };
      expect(read('<text-note textFormat="formatted"></text-note>')).toBe('formatted');
      expect(read('<text-note isLock="false"></text-note>')).toBe('normal');
      expect(read('<text-note textFormat="html"></text-note>')).toBe('normal');
    });

    it('leaves the body text untouched', () => {
      const note = TextNote.create('t', '# 見出し\n- 項目');
      note.format = 'formatted';
      expect(note.text).toBe('# 見出し\n- 項目');
    });
  });

  describe('toTextNoteFormat', () => {
    it('keeps formatted and turns everything else into normal', () => {
      expect(toTextNoteFormat('formatted')).toBe('formatted');
      expect(toTextNoteFormat('normal')).toBe('normal');
      expect(toTextNoteFormat(undefined)).toBe('normal');
      expect(toTextNoteFormat(null)).toBe('normal');
      expect(toTextNoteFormat({})).toBe('normal');
    });
  });

  describe('text setter', () => {
    it('takes new text', () => {
      const note = TextNote.create('t', '初期テキスト');
      note.text = '変更後テキスト';
      expect(note.text).toBe('変更後テキスト');
    });
  });

  describe('what it inherits', () => {
    it('starts on the table', () => {
      const note = TextNote.create('t', 'text');
      expect(note.location.name).toBe('table');
    });
  });
});
