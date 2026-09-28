import { readFileSync } from 'node:fs';

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileArchiver } from '@axe/core/storage/file-archiver';
import { ImageFile } from '@axe/core/storage/image-file';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { ImageTag, SYSTEM_RESERVED_TAG } from '@axe/domain/media/image-tag';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { DroppedImageEventHandlerService } from '@axe/features/file/file-storage/dropped-image-event-handler.service';
import { FileStorageComponent, PENDING_NOTICE_KEYS } from '@axe/features/file/file-storage/file-storage.component';
import type { clearBackgroundAt, ClearBackgroundResult } from '@axe/features/file/file-storage/transparent-background';
import { expectPanelDragRecovery, PanelDragTestHostComponent } from '@axe/testing/panel-drag-recovery';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';
import type { Mock } from 'vitest';

describe('FileStorageComponent', () => {
  let component: FileStorageComponent;
  let fixture: ComponentFixture<FileStorageComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [FileStorageComponent, PanelDragTestHostComponent],
      providers: [...TEST_PROVIDERS],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FileStorageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lets the panel take the pointer again once the drag ends', async () => {
    await expectPanelDragRecovery(FileStorageComponent);
  });

  describe('keeping track of which files are picked', () => {
    it('picks one that was not picked', () => {
      component.imgBlockClick('img-123');
      expect(component['checkedFiles'].has('img-123')).toBe(true);
    });

    it('unpicks one that was', () => {
      component.imgBlockClick('img-123');
      component.imgBlockClick('img-123');
      expect(component['checkedFiles'].has('img-123')).toBe(false);
    });

    it('keeps several apart', () => {
      component.imgBlockClick('img-a');
      component.imgBlockClick('img-b');
      expect(component['checkedFiles'].has('img-a')).toBe(true);
      expect(component['checkedFiles'].has('img-b')).toBe(true);

      component.imgBlockClick('img-a');
      expect(component['checkedFiles'].has('img-a')).toBe(false);
      expect(component['checkedFiles'].has('img-b')).toBe(true);
    });
  });

  describe('changeTag', () => {
    it('returns early for the tag that means everything', () => {
      component['checkedFiles'].add('img-1');
      component.newTagName.set('全て');
      component.changeTag();
      // finishes without error, changing no tag
    });

    it('returns early for the reserved tag', () => {
      component['checkedFiles'].add('img-1');
      component.newTagName.set('システム予約');
      component.changeTag();
      // finishes without error
    });
  });

  describe('keeping a picture back', () => {
    function playing(role: PeerRole): void {
      PeerCursor.createMyCursor().role = role;
    }

    function put(identifier: string, tag = ''): void {
      const file = TestBed.inject(ImageStorage).add(identifier);
      if (tag) ImageTag.create(file.identifier).tag = tag;
    }

    afterEach(() => {
      PeerCursor.myCursor = null!;
    });

    it('is not something a player may do at all', () => {
      playing(PeerRole.Player);
      put('a-drawing');
      component.imgBlockClick('a-drawing');

      component.setCheckedSecret(true);

      expect(ImageTag.isSecret('a-drawing')).toBe(false);
      expect(component.canKeepSecret).toBe(false);
    });

    it('keeps back what the master ticked, and gives it up again', () => {
      playing(PeerRole.GameMaster);
      put('the-twist');
      component.imgBlockClick('the-twist');

      component.setCheckedSecret(true);
      expect(ImageTag.isSecret('the-twist')).toBe(true);

      component.setCheckedSecret(false);
      expect(ImageTag.isSecret('the-twist')).toBe(false);
    });

    it('leaves what the tool brought with it alone', () => {
      playing(PeerRole.GameMaster);
      put('a-die-face', SYSTEM_RESERVED_TAG);
      component.imgBlockClick('a-die-face');

      component.setCheckedSecret(true);

      expect(ImageTag.isSecret('a-die-face')).toBe(false);
    });

    it('leaves untouched anything the master did not tick', () => {
      playing(PeerRole.GameMaster);
      put('kept');
      put('not-kept');
      component.imgBlockClick('kept');

      component.setCheckedSecret(true);

      expect(ImageTag.isSecret('kept')).toBe(true);
      expect(ImageTag.isSecret('not-kept')).toBe(false);
    });
  });

  describe('holding a pasted or chosen picture before adding it', () => {
    let loadImages: ReturnType<typeof vi.spyOn>;
    let load: ReturnType<typeof vi.spyOn>;
    let revokeObjectURL: ReturnType<typeof vi.spyOn>;
    let clearBackground: Mock<typeof clearBackgroundAt>;
    let addUnconfirmed: ReturnType<typeof vi.spyOn>;

    function screenshot(): File {
      return new File([new Uint8Array(4)], 'image.png', { type: 'image/png' });
    }

    function transparentCopy(): File {
      return new File([new Uint8Array(2)], 'clipboard-transparent.webp', { type: 'image/webp' });
    }

    function pasteEvent(...files: File[]): ClipboardEvent {
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { files } });
      return event as ClipboardEvent;
    }

    function pasteBox(): HTMLElement {
      return fixture.nativeElement.querySelector('[data-testid="paste-box"]');
    }

    function pendingPanel(): HTMLElement | null {
      return fixture.nativeElement.querySelector('[data-testid="pending-image"]');
    }

    /** The buttons in an element, told apart by their icons. */
    function buttonsOf(element: HTMLElement | null): string[] {
      return Array.from(element?.querySelectorAll('button .material-icons') ?? []).map((icon) =>
        icon.textContent!.trim()
      );
    }

    function chooseFiles(...files: File[]): HTMLInputElement {
      const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: files, configurable: true });
      input.dispatchEvent(new Event('change'));
      return input;
    }

    /** A click on the preview, as the eyedropper takes it. */
    function clickPreview(): MouseEvent {
      const preview = pendingPanel()!.querySelector('img')!;
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'offsetX', { value: 10 });
      Object.defineProperty(event, 'offsetY', { value: 20 });
      Object.defineProperty(event, 'currentTarget', { value: preview });
      return event;
    }

    async function settle(): Promise<void> {
      await fixture.whenStable();
      fixture.detectChanges();
    }

    beforeEach(() => {
      let count = 0;
      vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:preview-${++count}`);
      revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      loadImages = vi
        .spyOn(TestBed.inject(FileArchiver), 'loadImages')
        .mockResolvedValue({ images: [ImageFile.createEmpty('pasted')], oversized: [] });
      load = vi.spyOn(TestBed.inject(FileArchiver), 'load').mockResolvedValue();
      clearBackground = vi.fn<typeof clearBackgroundAt>().mockResolvedValue({
        kind: 'cleared',
        file: transparentCopy(),
        color: { r: 255, g: 255, b: 255 },
      });
      component['clearBackground'] = clearBackground;
      component['canClear'] = () => Promise.resolve(true);
      addUnconfirmed = vi.spyOn(TestBed.inject(DroppedImageEventHandlerService), 'addUnconfirmed').mockResolvedValue();
      fixture.detectChanges();
    });

    afterEach(async () => {
      // Closed while the stand-ins are still in place, so what it hands over goes nowhere real.
      fixture.destroy();
      await new Promise((resolve) => setTimeout(resolve));
      PeerCursor.myCursor = null!;
      vi.restoreAllMocks();
    });

    it('holds a picture pasted into the box for confirmation, storing nothing yet', () => {
      const event = pasteEvent(screenshot());
      pasteBox().dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(component.pendingImage()?.original.file.name).toMatch(/^clipboard-\d{8}-\d{6}\.png$/);
      expect(component.pendingImage()?.original.url).toBe('blob:preview-1');
      expect(loadImages).not.toHaveBeenCalled();
    });

    it('shows the held picture with the choice to add it, make it transparent or not add it', async () => {
      pasteBox().dispatchEvent(pasteEvent(screenshot()));
      await settle();

      expect(pendingPanel()!.querySelector('img')?.getAttribute('src')).toBe('blob:preview-1');
      expect(buttonsOf(pendingPanel())).toEqual(['colorize', 'add_photo_alternate', 'close']);
    });

    it('offers no transparency for a moving picture', async () => {
      component['canClear'] = () => Promise.resolve(false);
      pasteBox().dispatchEvent(pasteEvent(new File(['GIF89a'], 'a.gif', { type: 'image/gif' })));
      await settle();

      expect(buttonsOf(pendingPanel())).toEqual(['add_photo_alternate', 'close']);
    });

    it('leaves alone a paste made anywhere else on the page', () => {
      const event = pasteEvent(screenshot());
      document.body.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(component.pendingImage()).toBeNull();
    });

    it('stores the held picture through the upload path once confirmed', async () => {
      pasteBox().dispatchEvent(pasteEvent(screenshot()));
      const held = component.pendingImage()!.original.file;

      await component.confirmPending();

      expect(loadImages).toHaveBeenCalledWith([held]);
      expect(component.pendingImage()).toBeNull();
      expect(component.pendingNotice()).toBe('added');
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    });

    it('announces the outcome in a status line that stays in place', async () => {
      pasteBox().dispatchEvent(pasteEvent(screenshot()));
      await component.confirmPending();
      fixture.detectChanges();

      const status = fixture.nativeElement.querySelector('[data-testid="pending-notice"]') as HTMLElement;
      expect(status.getAttribute('role')).toBe('status');
      expect(status.textContent!.trim()).toBe('画像を追加しました');
      expect(document.activeElement).toBe(pasteBox());
    });

    it('tells the user when the same picture is already stored', async () => {
      TestBed.inject(ImageStorage).add('pasted');
      pasteBox().dispatchEvent(pasteEvent(screenshot()));

      await component.confirmPending();

      expect(component.pendingNotice()).toBe('duplicate');
    });

    it('tells the user when the picture is over the size limit', async () => {
      loadImages.mockResolvedValue({ images: [], oversized: ['clipboard.png'] });
      pasteBox().dispatchEvent(pasteEvent(screenshot()));

      await component.confirmPending();

      expect(component.pendingNotice()).toBe('oversized');
    });

    it('tells the user when storing fails', async () => {
      loadImages.mockRejectedValue(new Error('decode failed'));
      pasteBox().dispatchEvent(pasteEvent(screenshot()));

      await component.confirmPending();

      expect(component.pendingNotice()).toBe('failed');
      expect(component.pendingAdding()).toBe(false);
    });

    it('drops the held picture when the user decides against it', () => {
      pasteBox().dispatchEvent(pasteEvent(screenshot()));

      component.cancelPending();

      expect(component.pendingImage()).toBeNull();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
      expect(loadImages).not.toHaveBeenCalled();
    });

    describe('when the panel closes', () => {
      it('hands the held picture over to be added, and lets go of the preview', async () => {
        pasteBox().dispatchEvent(pasteEvent(screenshot()));
        const held = component.pendingImage()!.original.file;

        fixture.destroy();
        await vi.waitFor(() => expect(addUnconfirmed).toHaveBeenCalled());

        expect(addUnconfirmed).toHaveBeenCalledWith([{ file: held, place: null }]);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
      });

      it('hands over a dropped one with where it was dropped, as its transparent copy if made', async () => {
        const place = { point: { x: 30, y: 40 }, target: document.body };
        component.holdDroppedImage(screenshot(), place);
        await settle();
        component.togglePicking();
        await component.pickColor(clickPreview());
        const copy = component.pendingImage()!.transparent!.file;

        fixture.destroy();
        await vi.waitFor(() => expect(addUnconfirmed).toHaveBeenCalled());

        expect(addUnconfirmed).toHaveBeenCalledWith([{ file: copy, place }]);
      });

      it('hands over nothing the user cancelled', async () => {
        pasteBox().dispatchEvent(pasteEvent(screenshot()));
        component.cancelPending();

        fixture.destroy();
        await new Promise((resolve) => setTimeout(resolve));

        expect(addUnconfirmed).not.toHaveBeenCalled();
        expect(loadImages).not.toHaveBeenCalled();
      });

      it('waits for an add under way, handing over nothing it stored', async () => {
        let finish!: (value: { images: ImageFile[]; oversized: string[] }) => void;
        loadImages.mockReturnValue(new Promise((resolve) => (finish = resolve)));
        pasteBox().dispatchEvent(pasteEvent(screenshot()));
        const confirming = component.confirmPending();

        fixture.destroy();
        finish({ images: [ImageFile.createEmpty('pasted')], oversized: [] });
        await confirming;
        await new Promise((resolve) => setTimeout(resolve));

        expect(loadImages).toHaveBeenCalledTimes(1);
        expect(addUnconfirmed).not.toHaveBeenCalled();
      });

      it('hands over a picture an add under way could not store', async () => {
        let finish!: (value: { images: ImageFile[]; oversized: string[] }) => void;
        loadImages.mockReturnValue(new Promise((resolve) => (finish = resolve)));
        pasteBox().dispatchEvent(pasteEvent(screenshot()));
        const held = component.pendingImage()!.original.file;
        const confirming = component.confirmPending();

        fixture.destroy();
        finish({ images: [], oversized: ['image.png'] });
        await confirming;
        await vi.waitFor(() => expect(addUnconfirmed).toHaveBeenCalled());

        expect(addUnconfirmed).toHaveBeenCalledWith([{ file: held, place: null }]);
      });

      it('keeps the held picture for handing over when the seat loses leave to add it', async () => {
        pasteBox().dispatchEvent(pasteEvent(screenshot()));
        const held = component.pendingImage()!.original.file;
        PeerCursor.createMyCursor().role = PeerRole.Guest;

        await component.confirmPending();
        expect(component.pendingNotice()).toBe('noPermission');
        expect(component.pendingImage()?.original.file).toBe(held);

        fixture.destroy();
        await vi.waitFor(() => expect(addUnconfirmed).toHaveBeenCalled());
        expect(addUnconfirmed).toHaveBeenCalledWith([{ file: held, place: null }]);
      });
    });

    it('holds a picture a closed panel could not add, saying so', async () => {
      const file = screenshot();

      component.holdDroppedImage(file, null, true);
      await vi.waitFor(() => expect(component['intake']).toBeNull());

      expect(component.pendingImage()?.original.file).toBe(file);
      expect(component.pendingNotice()).toBe('returned');
    });

    it('says so when the paste holds no picture', () => {
      pasteBox().dispatchEvent(pasteEvent());

      expect(component.pendingImage()).toBeNull();
      expect(component.pendingNotice()).toBe('none');
    });

    it('takes nothing from a seat that may not edit the table', () => {
      PeerCursor.createMyCursor().role = PeerRole.Guest;

      pasteBox().dispatchEvent(pasteEvent(screenshot()));

      expect(component.pendingImage()).toBeNull();
      expect(component.pendingNotice()).toBe('noPermission');
    });

    it('holds a single chosen picture under its own name instead of storing it at once', () => {
      const map = new File([new Uint8Array(3)], 'dungeon-map.jpg', { type: 'image/jpeg' });

      const input = chooseFiles(map);

      expect(component.pendingImage()?.original.file).toBe(map);
      expect(load).not.toHaveBeenCalled();
      expect(input.value).toBe('');
    });

    it('still loads several chosen files straight away', () => {
      const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })];

      chooseFiles(...files);

      expect(load).toHaveBeenCalledTimes(1);
      expect(Array.from(load.mock.calls[0][0] as File[])).toEqual(files);
      expect(component.pendingImage()).toBeNull();
    });

    it('still loads straight away a single file the preview cannot show', () => {
      const svg = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' });

      chooseFiles(svg);

      expect(load).toHaveBeenCalledTimes(1);
      expect(component.pendingImage()).toBeNull();
    });

    it('keeps a picture that could not be stored, so it can be tried again or cancelled', async () => {
      loadImages.mockResolvedValue({ images: [], oversized: ['clipboard.png'] });
      pasteBox().dispatchEvent(pasteEvent(screenshot()));

      await component.confirmPending();

      expect(component.pendingImage()).not.toBeNull();
      expect(revokeObjectURL).not.toHaveBeenCalled();
    });

    describe('a picture dropped on the page', () => {
      const place = { point: { x: 30, y: 40 }, target: document.body };

      it('is held for confirmation rather than stored at once', () => {
        const token = new File([new Uint8Array(3)], 'goblin.png', { type: 'image/png' });

        component.holdDroppedImage(token, place);

        expect(component.pendingImage()?.original.file).toBe(token);
        expect(loadImages).not.toHaveBeenCalled();
      });

      it('is placed where it was dropped once confirmed', async () => {
        const token = new File([new Uint8Array(3)], 'goblin.png', { type: 'image/png' });
        component.holdDroppedImage(token, place);

        await component.confirmPending();

        expect(loadImages).toHaveBeenCalledWith([token], place);
      });

      it('is placed as its transparent copy when one was made', async () => {
        component['canClear'] = () => Promise.resolve(true);
        component.holdDroppedImage(screenshot(), place);
        await settle();
        component.togglePicking();
        await component.pickColor(clickPreview());
        const copy = component.pendingImage()!.transparent!.file;

        await component.confirmPending();

        expect(loadImages).toHaveBeenCalledWith([copy], place);
      });
    });

    describe('when another picture arrives while one is held', () => {
      function named(name: string): File {
        return new File([new Uint8Array(3)], name, { type: 'image/png' });
      }

      async function pasteAndSettle(...files: File[]): Promise<void> {
        pasteBox().dispatchEvent(pasteEvent(...files));
        await vi.waitFor(() => expect(component['intake']).toBeNull());
      }

      it('adds the held one to the room, then holds the new one', async () => {
        loadImages.mockResolvedValue({ images: [ImageFile.createEmpty('first-added')], oversized: [] });
        const first = named('first.png');
        await pasteAndSettle(first);

        await pasteAndSettle(named('second.png'));

        expect(loadImages).toHaveBeenCalledTimes(1);
        expect(loadImages).toHaveBeenCalledWith([first]);
        expect(component.pendingImage()?.original.file.name).toBe('second.png');
        expect(component.pendingNotice()).toBe('previousAdded');
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
      });

      it('adds the transparent copy of the held one when one was made', async () => {
        await pasteAndSettle(named('first.png'));
        await settle();
        component.togglePicking();
        await component.pickColor(clickPreview());
        const copy = component.pendingImage()!.transparent!.file;

        await pasteAndSettle(named('second.png'));

        expect(loadImages).toHaveBeenCalledWith([copy]);
      });

      it('waits for a transparent copy still being made, and adds that', async () => {
        await pasteAndSettle(named('first.png'));
        await settle();
        let finish!: (value: ClearBackgroundResult) => void;
        clearBackground.mockReturnValue(new Promise((resolve) => (finish = resolve)));
        component.togglePicking();
        const picking = component.pickColor(clickPreview());

        pasteBox().dispatchEvent(pasteEvent(named('second.png')));
        expect(loadImages).not.toHaveBeenCalled();
        const copy = transparentCopy();
        finish({ kind: 'cleared', file: copy, color: { r: 0, g: 0, b: 0 } });
        await picking;
        await vi.waitFor(() => expect(component['intake']).toBeNull());

        expect(loadImages).toHaveBeenCalledWith([copy]);
        expect(component.pendingImage()?.original.file.name).toBe('second.png');
      });

      it('adds a dropped one where it was dropped before holding the next', async () => {
        const place = { point: { x: 30, y: 40 }, target: document.body };
        const token = named('goblin.png');
        component.holdDroppedImage(token, place);

        await pasteAndSettle(named('second.png'));

        expect(loadImages).toHaveBeenCalledWith([token], place);
        expect(component.pendingImage()?.place).toBeNull();
      });

      it('does the same for a picture chosen in the dialog', async () => {
        const first = named('first.png');
        await pasteAndSettle(first);

        chooseFiles(named('map.png'));
        await vi.waitFor(() => expect(component['intake']).toBeNull());

        expect(loadImages).toHaveBeenCalledWith([first]);
        expect(component.pendingImage()?.original.file.name).toBe('map.png');
        expect(load).not.toHaveBeenCalled();
      });

      it('keeps the held one, and does not take the new one, when the held one is too big', async () => {
        loadImages.mockResolvedValue({ images: [], oversized: ['first.png'] });
        await pasteAndSettle(named('first.png'));

        await pasteAndSettle(named('second.png'));

        expect(component.pendingImage()?.original.file.name).toBe('first.png');
        expect(component.pendingNotice()).toBe('keptOversized');
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      });

      it('keeps the held one when storing it fails', async () => {
        loadImages.mockRejectedValue(new Error('decode failed'));
        await pasteAndSettle(named('first.png'));

        await pasteAndSettle(named('second.png'));

        expect(component.pendingImage()?.original.file.name).toBe('first.png');
        expect(component.pendingNotice()).toBe('keptFailed');
      });

      it('keeps the held one when the paste holds no picture', async () => {
        await pasteAndSettle(named('first.png'));

        await pasteAndSettle();
        await pasteAndSettle(new File(['text'], 'notes.txt', { type: 'text/plain' }));

        expect(loadImages).not.toHaveBeenCalled();
        expect(component.pendingImage()?.original.file.name).toBe('first.png');
        expect(component.pendingNotice()).toBe('unsupported');
      });

      it('keeps the held one when the seat may no longer add pictures', async () => {
        await pasteAndSettle(named('first.png'));
        PeerCursor.createMyCursor().role = PeerRole.Guest;

        await pasteAndSettle(named('second.png'));

        expect(loadImages).not.toHaveBeenCalled();
        expect(component.pendingImage()?.original.file.name).toBe('first.png');
        expect(component.pendingNotice()).toBe('noPermission');
      });

      it('keeps the held one, not taking the next, when leave to add is lost before it arrives', async () => {
        await pasteAndSettle(named('first.png'));
        PeerCursor.createMyCursor().role = PeerRole.Guest;

        component.holdDroppedImage(named('second.png'), null, true);
        await vi.waitFor(() => expect(component['intake']).toBeNull());

        expect(loadImages).not.toHaveBeenCalled();
        expect(component.pendingImage()?.original.file.name).toBe('first.png');
        expect(component.pendingNotice()).toBe('keptNoPermission');
      });

      it('never adds the held one twice when it is already being added', async () => {
        const first = named('first.png');
        await pasteAndSettle(first);

        const confirming = component.confirmPending();
        await pasteAndSettle(named('second.png'));
        await confirming;

        expect(loadImages).toHaveBeenCalledTimes(1);
        expect(component.pendingImage()?.original.file.name).toBe('second.png');
      });

      it('takes pictures arriving together in turn', async () => {
        const first = named('first.png');
        const second = named('second.png');
        await pasteAndSettle(first);

        pasteBox().dispatchEvent(pasteEvent(second));
        await pasteAndSettle(named('third.png'));

        expect(loadImages.mock.calls.map((call: unknown[]) => (call[0] as File[])[0].name)).toEqual([
          'first.png',
          'second.png',
        ]);
        expect(component.pendingImage()?.original.file.name).toBe('third.png');
      });

      it('hands over, rather than holds, one still waiting its turn when the panel closes', async () => {
        let finish!: (value: { images: ImageFile[]; oversized: string[] }) => void;
        await pasteAndSettle(named('first.png'));
        loadImages.mockReturnValue(new Promise((resolve) => (finish = resolve)));
        const second = named('second.png');

        pasteBox().dispatchEvent(pasteEvent(second));
        fixture.destroy();
        finish({ images: [ImageFile.createEmpty('pasted')], oversized: [] });
        await vi.waitFor(() => expect(addUnconfirmed).toHaveBeenCalled());

        expect(loadImages).toHaveBeenCalledTimes(1);
        expect(addUnconfirmed).toHaveBeenCalledWith([{ file: second, place: null }]);
        expect(component.pendingImage()).toBeNull();
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      });

      it('hands over the held one and the next when the held one fails as the panel closes', async () => {
        let finish!: (value: { images: ImageFile[]; oversized: string[] }) => void;
        const first = named('first.png');
        await pasteAndSettle(first);
        loadImages.mockReturnValue(new Promise((resolve) => (finish = resolve)));
        const second = named('second.png');

        pasteBox().dispatchEvent(pasteEvent(second));
        fixture.destroy();
        finish({ images: [], oversized: ['first.png'] });
        await vi.waitFor(() => expect(addUnconfirmed).toHaveBeenCalled());

        expect(addUnconfirmed).toHaveBeenCalledWith([
          { file: first, place: null },
          { file: second, place: null },
        ]);
      });
    });

    describe('making the background transparent', () => {
      beforeEach(async () => {
        pasteBox().dispatchEvent(pasteEvent(screenshot()));
        await settle();
      });

      it('only picks a colour once the eyedropper is taken up', async () => {
        await component.pickColor(clickPreview());

        expect(clearBackground).not.toHaveBeenCalled();
        expect(component.pendingImage()?.transparent).toBeNull();
      });

      it('clears the colour under the click from the original and previews the copy', async () => {
        component.togglePicking();
        fixture.detectChanges();
        const preview = pendingPanel()!.querySelector('img')!;
        const original = component.pendingImage()!.original;

        await component.pickColor(clickPreview());
        fixture.detectChanges();

        expect(clearBackground).toHaveBeenCalledWith(
          original.file,
          { x: 10, y: 20 },
          { width: preview.clientWidth, height: preview.clientHeight }
        );
        expect(component.pickingColor()).toBe(false);
        expect(component.pendingImage()?.original).toBe(original);
        expect(pendingPanel()!.querySelector('img')?.getAttribute('src')).toBe('blob:preview-2');
        expect(buttonsOf(pendingPanel())).toEqual(['colorize', 'undo', 'add_photo_alternate', 'close']);
      });

      it('shows the original again while picking anew, and replaces the earlier copy', async () => {
        component.togglePicking();
        await component.pickColor(clickPreview());
        component.togglePicking();
        fixture.detectChanges();

        expect(pendingPanel()!.querySelector('img')?.getAttribute('src')).toBe('blob:preview-1');

        await component.pickColor(clickPreview());

        expect(clearBackground).toHaveBeenLastCalledWith(
          component.pendingImage()!.original.file,
          expect.anything(),
          expect.anything()
        );
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-2');
        expect(component.pendingImage()?.transparent?.url).toBe('blob:preview-3');
      });

      it('stores the transparent copy, not the original, once confirmed', async () => {
        component.togglePicking();
        await component.pickColor(clickPreview());
        const copy = component.pendingImage()!.transparent!.file;

        await component.confirmPending();

        expect(loadImages).toHaveBeenCalledWith([copy]);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-2');
      });

      it('goes back to the original on undo', async () => {
        component.togglePicking();
        await component.pickColor(clickPreview());
        const original = component.pendingImage()!.original.file;

        component.undoTransparent();
        await component.confirmPending();

        expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-2');
        expect(loadImages).toHaveBeenCalledWith([original]);
      });

      it('stores nothing, copy or original, when cancelled', async () => {
        component.togglePicking();
        await component.pickColor(clickPreview());

        component.cancelPending();

        expect(loadImages).not.toHaveBeenCalled();
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-2');
      });

      it('keeps picking after a click beside the picture', async () => {
        clearBackground.mockResolvedValue({ kind: 'missed' });
        component.togglePicking();

        await component.pickColor(clickPreview());

        expect(component.pickingColor()).toBe(true);
        expect(component.pendingNotice()).toBe('pickMissed');
        expect(component.pendingImage()?.transparent).toBeNull();
      });

      it('keeps the original when the copy cannot be made', async () => {
        clearBackground.mockResolvedValue({ kind: 'failed' });
        component.togglePicking();

        await component.pickColor(clickPreview());

        expect(component.pendingNotice()).toBe('clearFailed');
        expect(component.pendingImage()?.transparent).toBeNull();
      });

      it('throws away a copy that finishes after the picture was dropped', async () => {
        let finish!: (value: ClearBackgroundResult) => void;
        clearBackground.mockReturnValue(new Promise((resolve) => (finish = resolve)));
        component.togglePicking();

        const picking = component.pickColor(clickPreview());
        component.cancelPending();
        finish({ kind: 'cleared', file: transparentCopy(), color: { r: 0, g: 0, b: 0 } });
        await picking;

        expect(component.pendingImage()).toBeNull();
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      });
    });

    it('has a message for every outcome and label in every language', () => {
      const labels = [
        'feature.file.fileStorage.paste.boxLabel',
        'feature.file.fileStorage.paste.hint',
        'feature.file.fileStorage.paste.read',
        'feature.file.fileStorage.pending.confirm',
        'feature.file.fileStorage.pending.add',
        'feature.file.fileStorage.pending.cancel',
        'feature.file.fileStorage.transparent.pick',
        'feature.file.fileStorage.transparent.repick',
        'feature.file.fileStorage.transparent.pickHint',
        'feature.file.fileStorage.transparent.applied',
        'feature.file.fileStorage.transparent.undo',
      ];
      for (const language of ['ja', 'en', 'ko']) {
        const dictionary = JSON.parse(readFileSync(`src/assets/i18n/${language}.json`, 'utf-8'));
        for (const key of [...labels, ...Object.values(PENDING_NOTICE_KEYS)]) {
          const text = key.split('.').reduce((node, part) => node?.[part], dictionary);
          expect(typeof text, `${language}: ${key}`).toBe('string');
        }
      }
    });
  });

  describe('the list of pictures', () => {
    function playing(role: PeerRole): void {
      PeerCursor.createMyCursor().role = role;
    }

    beforeEach(() => {
      const plain = TestBed.inject(ImageStorage).add('a-drawing');
      ImageTag.create(plain.identifier);
      const secret = TestBed.inject(ImageStorage).add('the-twist');
      ImageTag.create(secret.identifier).isSecret = true;
    });

    afterEach(() => {
      PeerCursor.myCursor = null!;
    });

    it('never shows a player what is being kept back', () => {
      playing(PeerRole.Player);

      const shown = component.getAllImage().map((image) => image.identifier);
      expect(shown).toContain('a-drawing');
      expect(shown).not.toContain('the-twist');
    });

    it('shows the master everything by default', () => {
      playing(PeerRole.GameMaster);

      expect(component.showSecret()).toBe(true);
      expect(component.getAllImage().map((image) => image.identifier)).toContain('the-twist');
    });

    it('folds them away for the master who asks, and leaves the rest', () => {
      playing(PeerRole.GameMaster);
      component.showSecret.set(false);

      const shown = component.getAllImage().map((image) => image.identifier);
      expect(shown).not.toContain('the-twist');
      expect(shown).toContain('a-drawing');
    });
  });
});
