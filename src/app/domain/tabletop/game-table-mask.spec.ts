import { TestBed } from '@angular/core/testing';
import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import { ObjectStore } from '@axe/core/sync/object-store';
import { DataElement } from '@axe/domain/data/data-element';
import { GameTableMask } from '@axe/domain/tabletop/game-table-mask';

describe('GameTableMask', () => {
  let store: ObjectStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = ObjectStore.instance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create()', () => {
    it('is created with a name and a size', () => {
      const mask = GameTableMask.create('テストマスク', 3, 4, 100);
      expect(mask).toBeTruthy();
      expect(mask.name).toBe('テストマスク');
      expect(mask.width).toBe(3);
      expect(mask.height).toBe(4);
    });

    it('is created against an identifier of its own', () => {
      const mask = GameTableMask.create('mask', 1, 1, 100, 'mask-id');
      expect(mask.identifier).toBe('mask-id');
    });

    it('is added to the store', () => {
      const mask = GameTableMask.create('mask', 1, 1, 100);
      expect(store.get(mask.identifier)).toBe(mask);
    });
  });

  describe('aliasName', () => {
    it('names itself a mask', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      expect(mask.aliasName).toBe('table-mask');
    });
  });

  describe('the defaults of the synchronised fields', () => {
    it('starts unlocked', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      expect(mask.isLock).toBe(false);
    });

    it('starts unowned', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      expect(mask.owner).toBe('');
    });

    it('starts showing the lock mark', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      expect(mask.dispLockMark).toBe(true);
    });

    it('starts out of preview', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      expect(mask.isPreview).toBe(false);
    });
  });

  describe('hasOwner', () => {
    it('is false while it is unowned', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      expect(mask.hasOwner).toBe(false);
    });

    it('is true once it has an owner', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      mask.owner = 'user-1';
      expect(mask.hasOwner).toBe(true);
    });
  });

  describe('ownerColor', () => {
    it('returns its own colour', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      expect(mask.ownerColor).toBe('#444444');
    });
  });

  describe('color', () => {
    it('falls back to a default colour when it carries none', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      expect(mask.color).toBe('#555555');
    });

    it('returns the colour it carries', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      mask.commonDataElement!.appendChild(
        DataElement.create('color', '#FF0000', { type: 'colors', currentValue: '#0a0a0a' }, 'color_' + mask.identifier)
      );
      expect(mask.color).toBe('#FF0000');
    });

    it('takes a new colour', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      mask.commonDataElement!.appendChild(
        DataElement.create('color', '#555555', { type: 'colors', currentValue: '#0a0a0a' }, 'color_' + mask.identifier)
      );
      mask.color = '#00FF00';
      expect(mask.color).toBe('#00FF00');
    });

    it('falls back to a default background when it carries none', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      expect(mask.bgcolor).toBe('#0a0a0a');
    });
  });

  describe('text settings', () => {
    it('provides defaults without mutating a legacy mask', () => {
      const mask = GameTableMask.create('legacy', 1, 1, 100);
      const before = mask.commonDataElement!.children.length;
      expect(mask.text).toBe('');
      expect(mask.fontSize).toBe(18);
      expect(mask.textOutline).toBe(false);
      expect(mask.outlineColor).toBe('#ffffff');
      expect(mask.commonDataElement!.children.length).toBe(before);
    });

    it('creates missing text fields lazily with stable identifiers', () => {
      const mask = GameTableMask.create('legacy', 1, 1, 100, 'mask-id');
      mask.text = 'hello';
      mask.text = 'updated';
      mask.fontSize = 24;
      mask.textOutline = true;
      mask.outlineColor = '#123456';
      expect(mask.commonDataElement!.getFirstElementByName('text')!.identifier).toBe('text_mask-id');
      expect(mask.commonDataElement!.getFirstElementByName('fontsize')!.identifier).toBe('fontsize_mask-id');
      expect(mask.commonDataElement!.getFirstElementByName('textoutline')!.identifier).toBe('textoutline_mask-id');
      expect(mask.text).toBe('updated');
      expect(mask.commonDataElement!.getFirstElementByName('text')!.currentValue).toBe('updated');
      expect(mask.fontSize).toBe(24);
      expect(mask.textOutline).toBe(true);
      expect(mask.outlineColor).toBe('#123456');
    });

    it('creates the paired color element without losing background semantics', () => {
      const mask = GameTableMask.create('legacy', 1, 1, 100, 'mask-id');
      mask.color = '#112233';
      mask.bgcolor = '#445566';
      const color = mask.commonDataElement!.getFirstElementByName('color')!;
      expect(color.type).toBe('colors');
      expect(color.value).toBe('#112233');
      expect(color.currentValue).toBe('#445566');
    });
  });

  describe('what it inherits', () => {
    it('starts on the table', () => {
      const mask = GameTableMask.create('test', 1, 1, 100);
      expect(mask.location.name).toBe('table');
    });
  });

  it('round-trips text, outline, and paired colours through XML', () => {
    const mask = GameTableMask.create('mask', 2, 2, 100, 'mask-id');
    mask.text = 'A & B\n|漢《かん》';
    mask.fontSize = 32;
    mask.color = '#112233';
    mask.bgcolor = '#445566';
    mask.textOutline = true;
    mask.outlineColor = '#abcdef';
    const xml = mask.toXml().replace(/location\.[a-z]+="[^"]*"\s*/g, '');
    const restored = ObjectSerializer.instance.parseXml(xml) as GameTableMask;
    expect(restored.text).toBe(mask.text);
    expect(restored.fontSize).toBe(32);
    expect(restored.color).toBe('#112233');
    expect(restored.bgcolor).toBe('#445566');
    expect(restored.textOutline).toBe(true);
    expect(restored.outlineColor).toBe('#abcdef');
  });

  it('clamps invalid imported font size and falls back invalid outline colour', () => {
    const mask = GameTableMask.create('Imported mask', 1, 1, 100);
    mask.commonDataElement!.appendChild(DataElement.create('fontsize', '999'));
    mask.commonDataElement!.appendChild(DataElement.create('outlinecolor', 'invalid'));
    expect(mask.fontSize).toBe(120);
    expect(mask.outlineColor).toBe('#ffffff');
    const size = mask.commonDataElement!.getFirstElementByName('fontsize')!;
    size.value = '-1';
    expect(mask.fontSize).toBe(1);
    size.value = 'invalid';
    expect(mask.fontSize).toBe(18);
    mask.destroy();
  });
});
