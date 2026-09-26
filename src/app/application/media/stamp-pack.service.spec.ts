import { TestBed } from '@angular/core/testing';
import { StampArchiveProblem, StampPackArchive, StampPackService } from '@axe/application/media/stamp-pack.service';
import { FileArchiver } from '@axe/core/storage/file-archiver';
import { calcSHA256Async } from '@axe/core/storage/file-reader-util';
import { ImageFile } from '@axe/core/storage/image-file';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { createZipBlob } from '@axe/core/storage/zip-archive';
import { ObjectStore } from '@axe/core/sync/object-store';
import { STAMP_LIMITS, StampItem, StampPack } from '@axe/domain/media/stamp-pack';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

/** A still PNG as far as the checks read one, told apart from others by its last byte. */
function pngBytes(mark: number, padding = 0): Uint8Array<ArrayBuffer> {
  const head = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x44, 0x41, 0x54, 0, 0, 0, 0];
  return new Uint8Array([...head, ...new Array<number>(padding).fill(0), mark]);
}

function pngFile(name: string, mark: number, padding = 0): File {
  return new File([pngBytes(mark, padding)], name, { type: 'image/png' });
}

function gifFile(name: string): File {
  return new File([new TextEncoder().encode('GIF89a' + '\0'.repeat(20))], name, { type: 'image/gif' });
}

describe('StampPackService', () => {
  let service: StampPackService;
  let addAsync: ReturnType<typeof vi.spyOn>;
  let measure: ReturnType<typeof vi.spyOn>;

  /** Stores a picture as the image store does for bytes that are already a stamp: under their hash. */
  async function store(blob: Blob): Promise<ImageFile> {
    const bytes = await blob.arrayBuffer();
    const identifier = await calcSHA256Async(bytes);
    return ImageStorage.instance.add(
      ImageFile.create({
        identifier,
        name: '',
        type: blob.type,
        blob: new Blob([bytes], { type: blob.type }),
        url: '',
        thumbnail: { type: '', blob: null, url: '' },
      })
    );
  }

  function beSeat(role: PeerRole): void {
    PeerCursor.myCursor = { role, identifier: 'seat-cursor' } as PeerCursor;
  }

  function newPack(name = 'pack'): StampPack {
    const pack = service.createPack(name);
    if (!(pack instanceof StampPack)) throw new Error(String(pack));
    return pack;
  }

  async function addedStamp(pack: StampPack, file: File): Promise<StampItem> {
    const item = await service.addStamp(pack, file);
    if (typeof item === 'string') throw new Error(item);
    return item;
  }

  /** The files a pack is saved into, as the save would zip them. */
  async function exportedFiles(pack: StampPack): Promise<File[]> {
    const saveAsync = vi.spyOn(TestBed.inject(FileArchiver), 'saveAsync').mockResolvedValue(undefined);
    await service.exportPack(pack);
    const files = saveAsync.mock.calls[0][0] as File[];
    saveAsync.mockRestore();
    return files;
  }

  async function readArchive(files: File[]): Promise<StampPackArchive> {
    const archive = await service.readArchive(await createZipBlob(files));
    if (typeof archive === 'string') throw new Error(archive);
    return archive;
  }

  function packXml(attributes: Record<string, string>): File {
    const written = Object.entries(attributes)
      .map(([name, value]) => `${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
      .join(' ');
    return new File([`<?xml version="1.0" encoding="UTF-8"?><stamp-pack ${written}></stamp-pack>`], 'data.xml', {
      type: 'text/plain',
    });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    service = TestBed.inject(StampPackService);
    addAsync = vi.spyOn(ImageStorage.instance, 'addAsync').mockImplementation((blob) => store(blob));
    // Resampling and measuring need a browser; here a picture is taken as already small enough.
    const seams = service as unknown as {
      shrink: (file: File) => Promise<Blob>;
      measure: (blob: Blob) => Promise<string>;
    };
    vi.spyOn(seams, 'shrink').mockImplementation(async (file) => file);
    measure = vi.spyOn(seams, 'measure').mockResolvedValue('fits');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const image of ImageStorage.instance.images) ImageStorage.instance.delete(image.identifier);
  });

  describe('making and changing packs', () => {
    it('makes a pack, renames it and throws it away', () => {
      const pack = newPack('  いつもの  ');
      expect(pack.name).toBe('いつもの');
      expect(service.packs()).toEqual([pack]);

      service.renamePack(pack, 'よく使う');
      expect(pack.name).toBe('よく使う');
      service.renamePack(pack, '   ');
      expect(pack.name).toBe('よく使う');

      service.deletePack(pack);
      expect(service.packs()).toEqual([]);
    });

    it('makes no more packs than a room may hold', () => {
      for (let index = 0; index < STAMP_LIMITS.packsPerRoom; index++) newPack(`pack ${index}`);
      expect(service.createPack('one too many')).toBe('packLimit');
      expect(service.packs()).toHaveLength(STAMP_LIMITS.packsPerRoom);
    });

    it('adds a picture as a stamp named after its file, and edits and removes it', async () => {
      const pack = newPack();
      const item = await addedStamp(pack, pngFile('thumbs up.png', 1));

      expect(item.name).toBe('thumbs up');
      expect(item.words).toEqual([]);
      expect(ImageStorage.instance.get(item.imageIdentifier)).not.toBeNull();
      expect(pack.items).toEqual([item]);

      service.updateStamp(pack, item.id, { name: 'いいね', words: 'good, いいね ok' });
      expect(pack.itemOf(item.id)).toMatchObject({ name: 'いいね', words: ['good', 'いいね', 'ok'] });
      service.updateStamp(pack, item.id, { name: '' });
      expect(pack.itemOf(item.id)?.name).toBe('いいね');

      service.removeStamp(pack, item.id);
      expect(pack.items).toEqual([]);
      expect(ImageStorage.instance.get(item.imageIdentifier)).not.toBeNull();
    });

    it('adds no more stamps than a pack may hold', async () => {
      const pack = newPack();
      pack.setItems(
        Array.from({ length: STAMP_LIMITS.stampsPerPack }, (_, index) => ({
          id: `s${index}`,
          name: `s${index}`,
          imageIdentifier: 'image',
          words: [],
        }))
      );
      expect(await service.addStamp(pack, pngFile('a.png', 1))).toBe('stampLimit');
      expect(addAsync).not.toHaveBeenCalled();
    });
  });

  describe('checking a picture', () => {
    it('turns away what is not a picture', async () => {
      const pack = newPack();
      const text = new File(['hello'], 'note.png', { type: 'image/png' });
      expect(await service.addStamp(pack, text)).toBe('notImage');
      expect(pack.items).toEqual([]);
    });

    it('turns away a moving picture', async () => {
      expect(await service.addStamp(newPack(), gifFile('dance.gif'))).toBe('animated');
    });

    it('turns away a picture still too large once shrunk', async () => {
      const big = pngFile('big.png', 1, STAMP_LIMITS.imageBytes);
      expect(await service.addStamp(newPack(), big)).toBe('tooLarge');
      expect(addAsync).not.toHaveBeenCalled();
    });

    it('turns away a picture still too wide once shrunk, or one that cannot be drawn', async () => {
      measure.mockResolvedValueOnce('tooLarge');
      expect(await service.addStamp(newPack(), pngFile('wide.png', 1))).toBe('tooLarge');
      measure.mockResolvedValueOnce('unreadable');
      expect(await service.addStamp(newPack(), pngFile('broken.png', 2))).toBe('notImage');
      expect(addAsync).not.toHaveBeenCalled();
    });
  });

  describe('a seat that is only watching', () => {
    it('changes nothing', async () => {
      const pack = newPack('mine');
      const item = await addedStamp(pack, pngFile('a.png', 1));
      beSeat(PeerRole.Guest);

      expect(service.canEdit).toBe(false);
      expect(service.createPack('theirs')).toBe('forbidden');
      expect(service.renamePack(pack, 'theirs')).toBe('forbidden');
      expect(await service.addStamp(pack, pngFile('b.png', 2))).toBe('forbidden');
      expect(service.updateStamp(pack, item.id, { name: 'theirs' })).toBe('forbidden');
      expect(service.removeStamp(pack, item.id)).toBe('forbidden');
      expect(service.deletePack(pack)).toBe('forbidden');

      expect(service.packs()).toEqual([pack]);
      expect(pack.name).toBe('mine');
      expect(pack.items).toEqual([item]);
    });

    it('brings no pack file in', async () => {
      const pack = newPack('mine');
      await addedStamp(pack, pngFile('a.png', 1));
      const archive = await readArchive(await exportedFiles(pack));
      beSeat(PeerRole.Guest);

      expect(await service.importArchive(archive)).toBe('forbidden');
    });
  });

  describe('a pack file', () => {
    it('comes back as the same pack after the pack and its pictures are gone', async () => {
      const pack = newPack('いつもの');
      const first = await addedStamp(pack, pngFile('a.png', 1));
      await addedStamp(pack, pngFile('b.png', 2));
      service.updateStamp(pack, first.id, { words: 'ok いいね' });
      const identifier = pack.identifier;
      const items = pack.items;
      const files = await exportedFiles(pack);

      expect(files.map((file) => file.name)).toContain('data.xml');
      for (const item of items) expect(files.map((file) => file.name)).toContain(`${item.imageIdentifier}.png`);

      ObjectStore.instance.remove(pack);
      for (const image of ImageStorage.instance.images) ImageStorage.instance.delete(image.identifier);
      addAsync.mockClear();

      const archive = await readArchive(files);
      expect(archive.identifier).toBe(identifier);
      expect(archive.images.size).toBe(2);
      const restored = await service.importArchive(archive);

      expect(restored).toBeInstanceOf(StampPack);
      expect((restored as StampPack).identifier).toBe(identifier);
      expect((restored as StampPack).name).toBe('いつもの');
      expect((restored as StampPack).items).toEqual(items);
      expect(addAsync).toHaveBeenCalledTimes(2);
      for (const item of items) expect(ImageStorage.instance.get(item.imageIdentifier)).not.toBeNull();
    });

    it('brings a pack the room already has up to date in place, without storing its pictures again', async () => {
      const pack = newPack('old name');
      const kept = await addedStamp(pack, pngFile('a.png', 1));
      const files = await exportedFiles(pack);
      service.renamePack(pack, 'renamed here');
      service.removeStamp(pack, kept.id);
      addAsync.mockClear();

      const archive = await readArchive(files);
      expect(service.existingPackOf(archive)).toBe(pack);
      expect(archive.images.size).toBe(0);
      const result = await service.importArchive(archive);

      expect(result).toBe(pack);
      expect(service.packs()).toEqual([pack]);
      expect(pack.name).toBe('old name');
      expect(pack.items).toEqual([kept]);
      expect(addAsync).not.toHaveBeenCalled();
    });

    it('brings a pack deleted here back under an identifier of its own', async () => {
      const pack = newPack();
      await addedStamp(pack, pngFile('a.png', 1));
      const files = await exportedFiles(pack);
      pack.destroy();

      const result = await service.importArchive(await readArchive(files));

      expect((result as StampPack).identifier).not.toBe(pack.identifier);
      expect(service.packs()).toHaveLength(1);
    });

    it('brings no new pack into a room already holding as many as it may', async () => {
      const pack = newPack();
      await addedStamp(pack, pngFile('a.png', 1));
      const files = await exportedFiles(pack);
      ObjectStore.instance.remove(pack);
      for (let index = 0; index < STAMP_LIMITS.packsPerRoom; index++) newPack(`pack ${index}`);

      expect(await service.importArchive(await readArchive(files))).toBe('packLimit');
    });

    describe('turned away', () => {
      async function problemOf(files: File[] | Blob): Promise<StampArchiveProblem> {
        const blob = files instanceof Blob ? files : await createZipBlob(files);
        const archive = await service.readArchive(blob);
        expect(typeof archive).toBe('string');
        return archive as StampArchiveProblem;
      }

      async function stampFor(bytes: Uint8Array<ArrayBuffer>): Promise<{ identifier: string; stamps: string }> {
        const identifier = await calcSHA256Async(bytes.slice().buffer);
        const stamps = JSON.stringify([{ id: 's1', name: 'one', imageIdentifier: identifier, words: [] }]);
        return { identifier, stamps };
      }

      it('when it is not a zip', async () => {
        expect(await problemOf(new Blob(['not a zip at all']))).toBe('notArchive');
      });

      it('when it holds no pack', async () => {
        expect(await problemOf([new File(['<room></room>'], 'data.xml')])).toBe('malformed');
        expect(await problemOf([new File(['hello'], 'readme.txt')])).toBe('malformed');
      });

      it('when the pack has no identifier or name, or broken stamps', async () => {
        expect(await problemOf([packXml({ name: 'x', stamps: '[]' })])).toBe('malformed');
        expect(await problemOf([packXml({ identifier: 'p', name: ' ', stamps: '[]' })])).toBe('malformed');
        expect(await problemOf([packXml({ identifier: 'p', name: 'x', stamps: '{oops' })])).toBe('malformed');
      });

      it('when it holds more stamps than a pack may', async () => {
        const stamps = JSON.stringify(
          Array.from({ length: STAMP_LIMITS.stampsPerPack + 1 }, (_, index) => ({
            id: `s${index}`,
            name: `s${index}`,
            imageIdentifier: 'image',
            words: [],
          }))
        );
        expect(await problemOf([packXml({ identifier: 'p', name: 'x', stamps })])).toBe('tooManyStamps');
      });

      it('when a picture a stamp shows is missing', async () => {
        const { stamps } = await stampFor(pngBytes(9));
        expect(await problemOf([packXml({ identifier: 'p', name: 'x', stamps })])).toBe('missingImage');
      });

      it('when a picture is not what its name says', async () => {
        const { identifier, stamps } = await stampFor(pngBytes(9));
        const swapped = new File([pngBytes(8)], `${identifier}.png`);
        expect(await problemOf([packXml({ identifier: 'p', name: 'x', stamps }), swapped])).toBe('badImage');
      });

      it('when a picture moves or is too large', async () => {
        const moving = new Uint8Array(new TextEncoder().encode('GIF89a' + '\0'.repeat(20)));
        const gif = await stampFor(moving);
        expect(
          await problemOf([
            packXml({ identifier: 'p', name: 'x', stamps: gif.stamps }),
            new File([moving], `${gif.identifier}.gif`),
          ])
        ).toBe('badImage');

        const large = pngBytes(1, STAMP_LIMITS.imageBytes);
        const big = await stampFor(large);
        expect(
          await problemOf([
            packXml({ identifier: 'p', name: 'x', stamps: big.stamps }),
            new File([large], `${big.identifier}.png`),
          ])
        ).toBe('badImage');
      });
    });
  });
});
