import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TestBed } from '@angular/core/testing';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { ObjectStore } from '@axe/core/sync/object-store';
import {
  BUILTIN_STAMP_ITEMS,
  BUILTIN_STAMP_PACK_IDENTIFIER,
  builtinStampPack,
  isBuiltinStampPack,
  registerBuiltinStamps,
} from '@axe/domain/media/builtin-stamps';
import { canBrowseImage, ImageTag, SYSTEM_RESERVED_TAG } from '@axe/domain/media/image-tag';
import {
  normalizeStampWords,
  parseStampItemsStrict,
  serializeStampItems,
  stampLabelOf,
  StampPack,
} from '@axe/domain/media/stamp-pack';
import { suggestStamps } from '@axe/domain/media/stamp-suggestion';

describe('the stamps the tool comes with', () => {
  let imageStorage: ImageStorage;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    imageStorage = ImageStorage.instance;
  });

  afterEach(() => {
    for (const image of [...imageStorage.images]) imageStorage.delete(image.identifier);
    for (const tag of ObjectStore.instance.getObjects<ImageTag>(ImageTag)) tag.destroy();
    ObjectStore.instance.clearDeleteHistory();
  });

  it('are the ten lettering stamps, each shown and logged by its phrase', () => {
    expect(BUILTIN_STAMP_ITEMS.map((item) => stampLabelOf(item))).toEqual([
      'いいね！',
      'こんにちは',
      'またね',
      'なんて？',
      'よろしく！',
      'ドンマイ',
      '質問です！',
      '生きててよかった',
      'すごい！',
      '尊い',
    ]);
    expect(new Set(BUILTIN_STAMP_ITEMS.map((item) => item.id)).size).toBe(BUILTIN_STAMP_ITEMS.length);
  });

  it('draw each stamp from a picture the tool serves', () => {
    for (const item of BUILTIN_STAMP_ITEMS)
      expect(item.imageIdentifier).toMatch(/^assets\/images\/stamps\/[a-z-]+\.png$/);
  });

  it('serve pictures already drawn, so no seat letters them in its own fonts', () => {
    for (const item of BUILTIN_STAMP_ITEMS) {
      const png = readFileSync(join('src', item.imageIdentifier));
      expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
      // IHDR: 240 x 240, 8-bit RGBA so the edges stay see-through.
      expect([png.readUInt32BE(16), png.readUInt32BE(20), png[24], png[25]]).toEqual([240, 240, 8, 6]);
      expect(png.length).toBeLessThan(40_000);
    }
  });

  it('keep words as a pack keeps them, so they read the same written out and back', () => {
    for (const item of BUILTIN_STAMP_ITEMS) expect(normalizeStampWords(item.words)).toEqual(item.words);
    expect(parseStampItemsStrict(serializeStampItems(BUILTIN_STAMP_ITEMS))).toEqual(BUILTIN_STAMP_ITEMS);
  });

  it('are found by their phrase and by a romanised word', () => {
    const pack = builtinStampPack('定番');
    expect(suggestStamps([pack], 'いいね')[0].item.id).toBe('builtin-iine');
    expect(suggestStamps([pack], 'toutoi')[0].item.id).toBe('builtin-toutoi');
  });

  it('are known from the room’s own packs', () => {
    expect(isBuiltinStampPack(builtinStampPack('定番'))).toBe(true);
    expect(isBuiltinStampPack({ identifier: 'some-room-pack' })).toBe(false);
    expect(builtinStampPack('Basics')).toMatchObject({ identifier: BUILTIN_STAMP_PACK_IDENTIFIER, name: 'Basics' });
  });

  describe('registerBuiltinStamps()', () => {
    it('puts each picture in the image store, named by its phrase and kept out of the library', () => {
      registerBuiltinStamps(imageStorage);

      for (const item of BUILTIN_STAMP_ITEMS) {
        const image = imageStorage.get(item.imageIdentifier)!;
        expect(image.url).toBe(item.imageIdentifier);
        expect(image.name).toBe(stampLabelOf(item));
        expect(ImageTag.get(item.imageIdentifier).tag).toBe(SYSTEM_RESERVED_TAG);
        expect(canBrowseImage(ImageTag.get(item.imageIdentifier), true)).toBe(false);
      }
    });

    it('adds no pack to the room, so nothing of them is saved or read back twice', () => {
      registerBuiltinStamps(imageStorage);
      registerBuiltinStamps(imageStorage);

      expect(ObjectStore.instance.getObjects(StampPack)).toEqual([]);
      const tags = ObjectStore.instance
        .getObjects<ImageTag>(ImageTag)
        .filter((tag) => tag.imageIdentifier === BUILTIN_STAMP_ITEMS[0].imageIdentifier);
      expect(tags).toHaveLength(1);
    });
  });
});
