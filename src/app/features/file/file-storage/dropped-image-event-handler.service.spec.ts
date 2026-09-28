import { TestBed } from '@angular/core/testing';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { FileArchiver, ImageDropPlace } from '@axe/core/storage/file-archiver';
import { ImageFile } from '@axe/core/storage/image-file';
import {
  DroppedImageEventHandlerService,
  DroppedImageHolder,
  PANEL_OPEN_TIMEOUT_MS,
} from '@axe/features/file/file-storage/dropped-image-event-handler.service';
import { RoomPanelService } from '@axe/features/panels/room-panel.service';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';
import type { Mock } from 'vitest';

describe('DroppedImageEventHandlerService', () => {
  const place: ImageDropPlace = { point: { x: 10, y: 20 }, target: null };
  let canEditTabletop: boolean;
  let open: ReturnType<typeof vi.fn>;
  let archiver: FileArchiver;

  function png(name = 'goblin.png'): File {
    return new File([new Uint8Array(3)], name, { type: 'image/png' });
  }

  function holder(): DroppedImageHolder & { holdDroppedImage: Mock<DroppedImageHolder['holdDroppedImage']> } {
    return { holdDroppedImage: vi.fn<DroppedImageHolder['holdDroppedImage']>() };
  }

  function drop(file: File): boolean {
    return archiver.singleFileDropHandler?.(file, place) ?? false;
  }

  beforeEach(() => {
    canEditTabletop = true;
    open = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        { provide: RoomPanelService, useValue: { open } },
        {
          provide: RolePermissionService,
          useValue: {
            get canEditTabletop() {
              return canEditTabletop;
            },
          },
        },
      ],
    });
    archiver = TestBed.inject(FileArchiver);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('hands a dropped picture to the open panel', () => {
    const panel = holder();
    TestBed.inject(DroppedImageEventHandlerService).attach(panel);
    const file = png();

    expect(drop(file)).toBe(true);

    expect(panel.holdDroppedImage).toHaveBeenCalledWith(file, place);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the panel once for pictures dropped while none is open, and hands them over in order', () => {
    const service = TestBed.inject(DroppedImageEventHandlerService);
    const first = png('first.png');
    const second = png('second.png');

    drop(first);
    drop(second);
    const panel = holder();
    service.attach(panel);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('fileStorage');
    expect(panel.holdDroppedImage.mock.calls.map((call) => call[0])).toEqual([first, second]);
  });

  it('hands pictures to the panel opened last, and stops once it closes', () => {
    const service = TestBed.inject(DroppedImageEventHandlerService);
    const older = holder();
    const newer = holder();
    service.attach(older);
    const detach = service.attach(newer);

    drop(png());
    detach();
    drop(png());

    expect(newer.holdDroppedImage).toHaveBeenCalledTimes(1);
    expect(older.holdDroppedImage).toHaveBeenCalledTimes(1);
  });

  it('leaves to load as before what the preview cannot show', () => {
    TestBed.inject(DroppedImageEventHandlerService);

    expect(drop(new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' }))).toBe(false);
    expect(drop(new File(['<room/>'], 'data.xml', { type: 'text/xml' }))).toBe(false);
    expect(drop(new File([new Uint8Array(1)], 'bgm.mp3', { type: 'audio/mpeg' }))).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves a drop by a seat that may not edit the table to load as before', () => {
    TestBed.inject(DroppedImageEventHandlerService);
    canEditTabletop = false;

    expect(drop(png())).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('hands a picture dropped while the panel opens over with exactly where it was dropped', () => {
    const service = TestBed.inject(DroppedImageEventHandlerService);
    const target = document.createElement('div');
    const exact: ImageDropPlace = { point: { x: 123, y: 456 }, target };
    const file = png();

    archiver.singleFileDropHandler?.(file, exact);
    const panel = holder();
    service.attach(panel);

    expect(panel.holdDroppedImage).toHaveBeenCalledWith(file, exact, false);
  });

  describe('when the panel cannot be opened', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('leaves the drop to load as before when opening throws', () => {
      TestBed.inject(DroppedImageEventHandlerService);
      open.mockImplementation(() => {
        throw new Error('no panel');
      });

      expect(drop(png())).toBe(false);
    });

    it('loads pictures dropped for a panel that never appears where they were dropped, then tries again', () => {
      const load = vi.spyOn(archiver, 'load').mockResolvedValue();
      TestBed.inject(DroppedImageEventHandlerService);
      const file = png();

      drop(file);
      vi.advanceTimersByTime(PANEL_OPEN_TIMEOUT_MS);

      expect(load).toHaveBeenCalledWith([file], place.point);
      drop(png());
      expect(open).toHaveBeenCalledTimes(2);
    });

    it('does not load them twice should the panel appear after all', () => {
      const load = vi.spyOn(archiver, 'load').mockResolvedValue();
      const service = TestBed.inject(DroppedImageEventHandlerService);

      drop(png());
      service.attach(holder());
      vi.advanceTimersByTime(PANEL_OPEN_TIMEOUT_MS);

      expect(load).not.toHaveBeenCalled();
    });
  });

  describe('what a closed panel left unconfirmed', () => {
    let loadImages: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      loadImages = vi
        .spyOn(archiver, 'loadImages')
        .mockResolvedValue({ images: [ImageFile.createEmpty('added')], oversized: [] });
    });

    it('is added, where it was dropped if it was, without opening anything', async () => {
      const service = TestBed.inject(DroppedImageEventHandlerService);
      const pasted = png('pasted.png');
      const dropped = png('dropped.png');

      await service.addUnconfirmed([
        { file: pasted, place: null },
        { file: dropped, place },
      ]);

      expect(loadImages).toHaveBeenNthCalledWith(1, [pasted]);
      expect(loadImages).toHaveBeenNthCalledWith(2, [dropped], place);
      expect(open).not.toHaveBeenCalled();
    });

    it('is brought back in a reopened panel when it cannot be added', async () => {
      loadImages.mockResolvedValue({ images: [], oversized: ['big.png'] });
      const service = TestBed.inject(DroppedImageEventHandlerService);
      const big = png('big.png');

      await service.addUnconfirmed([{ file: big, place }]);
      const panel = holder();
      service.attach(panel);

      expect(open).toHaveBeenCalledWith('fileStorage');
      expect(panel.holdDroppedImage).toHaveBeenCalledWith(big, place, true);
    });

    it('is brought back to a panel still open', async () => {
      loadImages.mockRejectedValue(new Error('decode failed'));
      const service = TestBed.inject(DroppedImageEventHandlerService);
      const panel = holder();
      service.attach(panel);
      const file = png();

      await service.addUnconfirmed([{ file, place: null }]);

      expect(panel.holdDroppedImage).toHaveBeenCalledWith(file, null, true);
      expect(open).not.toHaveBeenCalled();
    });

    it('is kept, not added, for a seat that may no longer edit the table', async () => {
      const service = TestBed.inject(DroppedImageEventHandlerService);
      canEditTabletop = false;
      const file = png();

      await service.addUnconfirmed([{ file, place: null }]);
      const panel = holder();
      service.attach(panel);

      expect(loadImages).not.toHaveBeenCalled();
      expect(panel.holdDroppedImage).toHaveBeenCalledWith(file, null, true);
    });

    it('waits for the next panel rather than loading when the reopened one never appears', async () => {
      vi.useFakeTimers();
      const load = vi.spyOn(archiver, 'load').mockResolvedValue();
      loadImages.mockResolvedValue({ images: [], oversized: ['big.png'] });
      const service = TestBed.inject(DroppedImageEventHandlerService);
      const big = png('big.png');

      await service.addUnconfirmed([{ file: big, place }]);
      vi.advanceTimersByTime(PANEL_OPEN_TIMEOUT_MS);
      const panel = holder();
      service.attach(panel);
      vi.useRealTimers();

      expect(load).not.toHaveBeenCalled();
      expect(panel.holdDroppedImage).toHaveBeenCalledWith(big, place, true);
    });
  });

  it('lets go of the archiver when the app goes', () => {
    TestBed.inject(DroppedImageEventHandlerService);
    expect(archiver.singleFileDropHandler).not.toBeNull();

    TestBed.resetTestingModule();

    expect(archiver.singleFileDropHandler).toBeNull();
  });
});
