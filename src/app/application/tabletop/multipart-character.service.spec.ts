import { TestBed } from '@angular/core/testing';
import { DisclosureService } from '@axe/application/permission/disclosure.service';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { MultipartCharacterService } from '@axe/application/tabletop/multipart-character.service';
import { TabletopService } from '@axe/application/tabletop/tabletop.service';
import { TabletopActionService } from '@axe/application/tabletop/tabletop-action.service';
import { ImageFile } from '@axe/core/storage/image-file';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import { ObjectStore } from '@axe/core/sync/object-store';
import { GameCharacter } from '@axe/domain/character/game-character';
import { decodePartRegion } from '@axe/domain/character/part-group';
import { DataElement } from '@axe/domain/data/data-element';
import { ImageTag } from '@axe/domain/media/image-tag';
import { allowDottedXmlAttributes } from '@axe/testing/dotted-xml-attributes';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('MultipartCharacterService', () => {
  let source: ImageFile;
  const table = { identifier: 'table', width: 20, height: 20, gridSize: 50 };
  const roles = { canEditTabletop: true, canSeeHidden: false };
  const tabletop = { currentTable: table };
  const disclosure = { canView: () => true };
  const image = { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;
  const parts = [
    { name: 'Head', x: 20, y: 0, width: 40, height: 30 },
    { name: 'Body', x: 20, y: 30, width: 40, height: 60 },
  ];
  let service: MultipartCharacterService;
  let images: ImageStorage;
  let added: ImageFile[];
  let created: GameCharacter[];
  let count: number;
  let beforeCrop: () => void;
  let crops: number;

  beforeEach(() => {
    source = ImageFile.create('https://example.invalid/original.png');
    roles.canEditTabletop = true;
    roles.canSeeHidden = false;
    tabletop.currentTable = table;
    added = [];
    created = [];
    count = 0;
    crops = 0;
    beforeCrop = () => {};
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    TestBed.overrideProvider(RolePermissionService, { useValue: roles });
    TestBed.overrideProvider(TabletopService, { useValue: tabletop });
    disclosure.canView = () => true;
    TestBed.overrideProvider(DisclosureService, { useValue: disclosure });
    TestBed.overrideProvider(TabletopActionService, {
      useValue: {
        createGameCharacterWith: (_p: unknown, name: string, id: string) => {
          const character = GameCharacter.create(name, 1, id);
          created.push(character);
          return character;
        },
      },
    });
    service = TestBed.inject(MultipartCharacterService);
    images = TestBed.inject(ImageStorage);
    images.add(source);
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag !== 'canvas') return originalCreate(tag);
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => {
            crops++;
            beforeCrop();
          },
        }),
        toBlob: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })),
      } as unknown as HTMLCanvasElement;
    });
    vi.spyOn(ImageFile, 'createAsync').mockImplementation(async () =>
      ImageFile.create(`https://example.invalid/part-${++count}.png`)
    );
    const add = images.add.bind(images);
    vi.spyOn(images, 'add').mockImplementation((file) => {
      added.push(file as ImageFile);
      return add(file);
    });
  });
  afterEach(() => {
    for (const character of created) character.destroy();
    for (const file of added) ImageTag.get(file.identifier)?.destroy();
    ImageTag.get(source.identifier)?.destroy();
    vi.restoreAllMocks();
    for (const file of added) images.delete(file.identifier);
    TestBed.resetTestingModule();
    images.delete(source.identifier);
  });

  it('creates normal characters with independent HP and source-relative positions', async () => {
    const result = await service.create(source.identifier, image, parts);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Head');
    const hp0 = result[0].detailDataElement!.getFirstElementByName('HP')!;
    const hp1 = result[1].detailDataElement!.getFirstElementByName('HP')!;
    hp0.currentValue = '123';
    expect(hp1.currentValue).toBe('200');
    expect(result[0].location.x).toBe(440);
    expect(result[0].location.y).toBe(390);
    expect(images.get(source.identifier)).toBe(source);
    expect(result[0].toContext().aliasName).toBe('character');
    const xml = ObjectSerializer.instance.toXml(result[0]);
    expect(xml).toContain('Head');
    expect(xml).toContain('part-1.png');
  });

  it('rejects overlapping parts before cropping or creating anything', async () => {
    const overlapping = [parts[0], { name: 'Body', x: 30, y: 20, width: 40, height: 60 }];
    await expect(service.create(source.identifier, image, overlapping)).rejects.toThrow('Unavailable');
    expect(crops).toBe(0);
    expect(added).toHaveLength(0);
    expect(created).toHaveLength(0);
  });

  it('makes no images or characters when a later crop fails', async () => {
    beforeCrop = () => {
      if (crops === 2) throw new Error('Canvas');
    };
    await expect(service.create(source.identifier, image, parts)).rejects.toThrow('Canvas');
    expect(added).toHaveLength(0);
    expect(created).toHaveLength(0);
  });

  it.each(['permission', 'close', 'table', 'source'] as const)(
    'rechecks %s after asynchronous preparation',
    async (change) => {
      let open = true;
      beforeCrop = () => {
        if (change === 'permission') roles.canEditTabletop = false;
        if (change === 'close') open = false;
        if (change === 'table') tabletop.currentTable = { ...table };
        if (change === 'source') images.delete(source.identifier);
      };
      await expect(service.create(source.identifier, image, parts, () => open)).rejects.toThrow('Unavailable');
      expect(added).toHaveLength(0);
      expect(created).toHaveLength(0);
    }
  );

  it('rejects private source images for players', async () => {
    const tag = ImageTag.create(source.identifier);
    tag.isSecret = true;
    await expect(service.create(source.identifier, image, parts)).rejects.toThrow('Unavailable');
    expect(crops).toBe(0);
  });

  describe('linked parts from a character', () => {
    const wide = { naturalWidth: 300, naturalHeight: 200 } as HTMLImageElement;
    const halves = [
      { name: 'Head', x: 0, y: 0, width: 150, height: 200 },
      { name: 'Tail', x: 150, y: 0, width: 150, height: 200 },
    ];
    let original: GameCharacter;
    let restoreXml: () => void;
    let parts: GameCharacter[];

    function hp(character: GameCharacter) {
      return character.detailDataElement!.getFirstElementByName('HP')!;
    }

    beforeEach(() => {
      restoreXml = allowDottedXmlAttributes();
      original = GameCharacter.create('Dragon', 2, source.identifier);
      original.addExtendData();
      original.location.x = 300;
      original.location.y = 200;
      original.rotate = 30;
      hp(original).currentValue = '150';
      original.buffDataElement!.appendChild(DataElement.create('Poison', '', {}, ''));
      created.push(original);
      parts = [];
    });
    afterEach(() => {
      restoreXml();
      for (const part of parts) part.destroy();
    });

    it('copies the whole character into each part and retires the original unchanged', async () => {
      parts = await service.createLinked(original, wide, halves, ' Wyrm ');
      expect(parts.map((part) => part.name)).toEqual(['Wyrm(Head)', 'Wyrm(Tail)']);
      const [head, tail] = parts;
      expect(head.partGroup).not.toBe('');
      expect(tail.partGroup).toBe(head.partGroup);
      expect([head.partGroupName, head.partName, tail.partName]).toEqual(['Wyrm', 'Head', 'Tail']);
      expect(decodePartRegion(head.partRegion)).toEqual({ x: 0, y: 0, width: 0.5, height: 1, aspect: 1.5 });
      expect(decodePartRegion(tail.partRegion)?.x).toBe(0.5);
      for (const part of parts) {
        expect(part.identifier).not.toBe(original.identifier);
        expect(String(hp(part).currentValue)).toBe('150');
        expect(part.chatPalette).not.toBeNull();
        expect(part.remoteController).not.toBeNull();
        expect(part.buffDataElement!.getFirstElementByName('Poison')).not.toBeNull();
        expect([part.location.name, part.location.x, part.location.y, part.rotate]).toEqual(['table', 300, 200, 30]);
        expect(part.imageFile.identifier).not.toBe(source.identifier);
      }
      expect(head.imageFile.identifier).not.toBe(tail.imageFile.identifier);
      hp(head).currentValue = '10';
      expect(String(hp(tail).currentValue)).toBe('150');
      expect(original.location.name).toBe('graveyard');
      expect(original.imageFile).toBe(source);
      expect(String(hp(original).currentValue)).toBe('150');
      expect(original.partGroup).toBe('');
      expect(images.get(source.identifier)).toBe(source);
    });

    it.each([
      ['a single part', () => service.createLinked(original, wide, [halves[0]], 'Wyrm')],
      ['an empty creature name', () => service.createLinked(original, wide, halves, '  ')],
      ['overlapping parts', () => service.createLinked(original, wide, [halves[0], { ...halves[1], x: 100 }], 'Wyrm')],
    ])('refuses %s before cropping anything', async (_, attempt) => {
      await expect(attempt()).rejects.toThrow('Unavailable');
      expect(crops).toBe(0);
      expect(original.location.name).toBe('table');
    });

    it('refuses a character off the table, one already a part, or one the reader may not view', async () => {
      original.location.name = 'graveyard';
      expect(service.mayLink(original)).toBe(false);
      original.location.name = 'table';
      original.partGroup = 'g';
      original.partRegion = '0 0 1 1 1';
      expect(service.mayLink(original)).toBe(false);
      original.partGroup = '';
      disclosure.canView = () => false;
      expect(service.mayLink(original)).toBe(false);
      await expect(service.createLinked(original, wide, halves, 'Wyrm')).rejects.toThrow('Unavailable');
      disclosure.canView = () => true;
      roles.canEditTabletop = false;
      expect(service.mayLink(original)).toBe(false);
      expect(crops).toBe(0);
    });

    it.each(['permission', 'retired', 'picture'] as const)(
      'publishes nothing when %s changes during preparation',
      async (change) => {
        const before = ObjectStore.instance.getObjects(GameCharacter).length;
        beforeCrop = () => {
          if (change === 'permission') roles.canEditTabletop = false;
          if (change === 'retired') original.location.name = 'graveyard';
          if (change === 'picture') original.imageSourceElement!.value = 'another-image';
        };
        await expect(service.createLinked(original, wide, halves, 'Wyrm')).rejects.toThrow('Unavailable');
        expect(ObjectStore.instance.getObjects(GameCharacter)).toHaveLength(before);
        expect(added).toHaveLength(0);
        if (change !== 'retired') expect(original.location.name).toBe('table');
      }
    );
  });

  it('preserves URLs merged into an existing incomplete image entry', async () => {
    const placeholder = ImageFile.createEmpty('https://example.invalid/part-1.png');
    const add = vi.mocked(images.add).getMockImplementation()!;
    add(placeholder);
    const prepared = ImageFile.create('https://example.invalid/part-1.png');
    const destroy = vi.spyOn(prepared, 'destroy');
    vi.mocked(ImageFile.createAsync).mockResolvedValue(prepared);
    await service.create(source.identifier, image, [parts[0]]);
    expect(images.get(prepared.identifier)).toBe(placeholder);
    expect(placeholder.url).toBe(prepared.url);
    expect(destroy).not.toHaveBeenCalled();
  });
});
