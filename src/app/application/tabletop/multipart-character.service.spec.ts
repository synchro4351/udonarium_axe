import { TestBed } from '@angular/core/testing';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { MultipartCharacterService } from '@axe/application/tabletop/multipart-character.service';
import { TabletopService } from '@axe/application/tabletop/tabletop.service';
import { TabletopActionService } from '@axe/application/tabletop/tabletop-action.service';
import { ImageFile } from '@axe/core/storage/image-file';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import { GameCharacter } from '@axe/domain/character/game-character';
import { ImageTag } from '@axe/domain/media/image-tag';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('MultipartCharacterService', () => {
  let source: ImageFile;
  const table = { identifier: 'table', width: 20, height: 20, gridSize: 50 };
  const roles = { canEditTabletop: true, canSeeHidden: false };
  const tabletop = { currentTable: table };
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
