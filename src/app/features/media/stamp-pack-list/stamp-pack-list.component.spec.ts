import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StampPackArchive, StampPackService } from '@axe/application/media/stamp-pack.service';
import { ConfirmService } from '@axe/application/ui/confirm.service';
import { ModalService } from '@axe/application/ui/modal.service';
import { StampPack } from '@axe/domain/media/stamp-pack';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { StampPackListComponent } from '@axe/features/media/stamp-pack-list/stamp-pack-list.component';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('StampPackListComponent', () => {
  let fixture: ComponentFixture<StampPackListComponent>;
  let service: StampPackService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StampPackListComponent], providers: [...TEST_PROVIDERS] });
    service = TestBed.inject(StampPackService);
    fixture = TestBed.createComponent(StampPackListComponent);
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function query<T extends Element = HTMLElement>(testId: string): T | null {
    return element().querySelector<T>(`[data-testid="${testId}"]`);
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function beSeat(role: PeerRole): void {
    PeerCursor.myCursor = { role, identifier: 'seat-cursor' } as PeerCursor;
  }

  function packWith(name: string): StampPack {
    const pack = new StampPack();
    pack.name = name;
    pack.setItems([{ id: 's1', name: 'ok', imageIdentifier: 'image-ok', words: ['ok'] }]);
    pack.initialize();
    return pack;
  }

  function chooseFile(testId: string, file: File): void {
    const input = query<HTMLInputElement>(testId)!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  it('makes a pack from the empty panel and shows it as a tab', async () => {
    await render();
    query('stamp-pack-create')!.click();
    await render();

    expect(service.packs()).toHaveLength(1);
    expect(element().querySelectorAll('[data-testid="stamp-pack-tab"]')).toHaveLength(1);
    expect(query<HTMLInputElement>('stamp-pack-name')!.value).toBe(service.packs()[0].name);
  });

  it('shows each pack as a tab and the open one as a grid of its stamps', async () => {
    packWith('first');
    const second = packWith('second');
    await render();

    const tabs = element().querySelectorAll<HTMLButtonElement>('[data-testid="stamp-pack-tab"]');
    expect(Array.from(tabs).map((tab) => tab.textContent?.trim())).toEqual(['first', 'second']);
    tabs[1].click();
    await render();

    expect(query<HTMLInputElement>('stamp-pack-name')!.value).toBe(second.name);
    expect(element().querySelectorAll('[data-testid="stamp-item"]')).toHaveLength(1);
    expect(query('stamp-pack-export')).not.toBeNull();
  });

  it('opens a stamp to edit its search words, the first of which it is then shown by', async () => {
    const pack = packWith('pack');
    await render();
    query('stamp-item')!.click();
    await render();

    expect(query('stamp-name')).toBeNull();
    const words = query<HTMLInputElement>('stamp-words')!;
    words.value = 'いいね, ok';
    words.dispatchEvent(new Event('input'));
    words.dispatchEvent(new Event('change'));
    await render();

    expect(pack.itemOf('s1')).toMatchObject({ name: 'いいね', words: ['いいね', 'ok'] });
    expect(query('stamp-item-label')!.textContent!.trim()).toBe('いいね');
    expect(query('stamp-words-state')!.textContent!.trim()).toBeTruthy();
  });

  it('shows a stamp added to the open pack at once, without changing tabs', async () => {
    const pack = packWith('pack');
    await render();
    expect(element().querySelectorAll('[data-testid="stamp-item"]')).toHaveLength(1);

    pack.setItems([...pack.items, { id: 's2', name: 'new', imageIdentifier: 'image-new', words: [] }]);
    await render();

    expect(element().querySelectorAll('[data-testid="stamp-item"]')).toHaveLength(2);
    expect(query('stamp-pack-count')!.textContent).toContain('2');
  });

  describe('search words being typed', () => {
    function twoStampPack(): StampPack {
      const pack = new StampPack();
      pack.name = 'pack';
      pack.setItems([
        { id: 's1', name: 'one', imageIdentifier: 'image-1', words: [] },
        { id: 's2', name: 'two', imageIdentifier: 'image-2', words: [] },
      ]);
      pack.initialize();
      return pack;
    }

    function stampButtons(): HTMLButtonElement[] {
      return Array.from(element().querySelectorAll<HTMLButtonElement>('[data-testid="stamp-item"]'));
    }

    function type(text: string): void {
      const words = query<HTMLInputElement>('stamp-words')!;
      words.value = text;
      words.dispatchEvent(new Event('input'));
    }

    it('are saved once typing pauses, without leaving the box', async () => {
      const pack = twoStampPack();
      await render();
      stampButtons()[0].click();
      await render();

      type('たぬき');
      await render();
      expect(query('stamp-words-state')!.textContent!.trim()).not.toBe('');

      await vi.waitFor(() => expect(pack.itemOf('s1')?.words).toEqual(['たぬき']), { timeout: 2000 });
    });

    it('stay with the stamp they were typed for when another is opened', async () => {
      const pack = twoStampPack();
      await render();
      stampButtons()[0].click();
      await render();

      type('first');
      stampButtons()[1].click();
      await render();

      expect(pack.itemOf('s1')?.words).toEqual(['first']);
      expect(pack.itemOf('s2')?.words).toEqual([]);
      expect(query<HTMLInputElement>('stamp-words')!.value).toBe('');
    });

    it('are saved when the panel closes before typing pauses', async () => {
      const pack = twoStampPack();
      await render();
      stampButtons()[0].click();
      await render();

      type('bye');
      fixture.destroy();

      expect(pack.itemOf('s1')?.words).toEqual(['bye']);
    });
  });

  it('shows the tool’s own stamps on a tab of their own, with nothing to change', async () => {
    packWith('pack');
    await render();

    query('stamp-builtin-tab')!.click();
    await render();

    expect(element().querySelectorAll('[data-testid="stamp-builtin-item"]')).toHaveLength(10);
    expect(query('stamp-pack-name')).toBeNull();
    expect(query('stamp-add')).toBeNull();
    expect(query('stamp-pack-delete')).toBeNull();
  });

  it('makes a room picture a stamp of the open pack when one is picked', async () => {
    const pack = packWith('pack');
    vi.spyOn(TestBed.inject(ModalService), 'open').mockResolvedValue('room-image');
    const addStampFromImage = vi
      .spyOn(service, 'addStampFromImage')
      .mockResolvedValue({ id: 's9', name: 'x', imageIdentifier: 'room-image', words: [] });
    await render();

    query('stamp-add-from-room')!.click();
    await vi.waitFor(() => expect(addStampFromImage).toHaveBeenCalledWith(pack, 'room-image'));
  });

  describe('files dropped on the panel', () => {
    function drop(files: File[]): Event {
      const event = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files } });
      query('stamp-pack-list')!.dispatchEvent(event);
      return event;
    }

    it('become stamps of the open pack, and go no further', async () => {
      const pack = packWith('pack');
      const addStamp = vi.spyOn(service, 'addStamp').mockResolvedValue('notImage');
      const onBody = vi.fn();
      document.body.addEventListener('drop', onBody);
      await render();

      try {
        const file = new File(['png'], 'wave.png', { type: 'image/png' });
        const event = drop([file]);
        await vi.waitFor(() => expect(addStamp).toHaveBeenCalledWith(pack, file));
        expect(event.defaultPrevented).toBe(true);
        expect(onBody).not.toHaveBeenCalled();
      } finally {
        document.body.removeEventListener('drop', onBody);
      }
    });

    it('are read in as a pack when one is a pack file', async () => {
      const readArchive = vi.spyOn(service, 'readArchive').mockResolvedValue('notArchive');
      await render();

      drop([new File(['zip'], 'stamp_tanuki.zip', { type: 'application/zip' })]);
      await vi.waitFor(() => expect(readArchive).toHaveBeenCalled());
    });

    it('are left to the room for a seat that may not change the packs', async () => {
      packWith('pack');
      beSeat(PeerRole.Guest);
      const addStamp = vi.spyOn(service, 'addStamp');
      await render();

      const event = drop([new File(['png'], 'wave.png', { type: 'image/png' })]);

      expect(event.defaultPrevented).toBe(false);
      expect(addStamp).not.toHaveBeenCalled();
    });
  });

  it('offers a seat only watching the packs to look at and save, and nothing to change', async () => {
    packWith('pack');
    beSeat(PeerRole.Guest);
    await render();
    query('stamp-item')!.click();
    await render();

    expect(query('stamp-pack-create')).toBeNull();
    expect(query('stamp-pack-import')).toBeNull();
    expect(query('stamp-pack-delete')).toBeNull();
    expect(query('stamp-add')).toBeNull();
    expect(query('stamp-remove')).toBeNull();
    expect(query<HTMLInputElement>('stamp-pack-name')!.disabled).toBe(true);
    expect(query<HTMLInputElement>('stamp-words')!.disabled).toBe(true);
    expect(query('stamp-pack-export')).not.toBeNull();
  });

  it('asks before throwing a pack away, and keeps it when told no', async () => {
    packWith('pack');
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(false);
    await render();

    query('stamp-pack-delete')!.click();
    await fixture.whenStable();

    expect(ask).toHaveBeenCalled();
    expect(service.packs()).toHaveLength(1);
  });

  describe('reading a pack file', () => {
    function archiveFor(pack: StampPack): StampPackArchive {
      return { identifier: pack.identifier, name: 'incoming', items: pack.items, images: new Map() };
    }

    it('asks before replacing a pack under the same identifier, and leaves it alone when told no', async () => {
      const pack = packWith('here');
      vi.spyOn(service, 'readArchive').mockResolvedValue(archiveFor(pack));
      const importArchive = vi.spyOn(service, 'importArchive');
      const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(false);
      await render();

      chooseFile('stamp-pack-import', new File(['zip'], 'stamp_here.zip'));
      await vi.waitFor(() => expect(ask).toHaveBeenCalled());
      await fixture.whenStable();

      expect(importArchive).not.toHaveBeenCalled();
      expect(pack.name).toBe('here');
    });

    it('replaces it once told yes', async () => {
      const pack = packWith('here');
      vi.spyOn(service, 'readArchive').mockResolvedValue(archiveFor(pack));
      vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);
      await render();

      chooseFile('stamp-pack-import', new File(['zip'], 'stamp_here.zip'));
      await vi.waitFor(() => expect(pack.name).toBe('incoming'));

      expect(service.packs()).toEqual([pack]);
    });

    it('reads a new pack in without asking', async () => {
      vi.spyOn(service, 'readArchive').mockResolvedValue({
        identifier: 'new-pack',
        name: 'new',
        items: [],
        images: new Map(),
      });
      const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask');
      await render();

      chooseFile('stamp-pack-import', new File(['zip'], 'stamp_new.zip'));
      await vi.waitFor(() => expect(service.packs()).toHaveLength(1));

      expect(ask).not.toHaveBeenCalled();
      expect(service.packs()[0].identifier).toBe('new-pack');
    });

    it('says why a file was turned away', async () => {
      vi.spyOn(service, 'readArchive').mockResolvedValue('missingImage');
      await render();

      chooseFile('stamp-pack-import', new File(['zip'], 'broken.zip'));
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(query('stamp-notice')?.textContent).toBeTruthy();
      });
      expect(service.packs()).toHaveLength(0);
    });
  });
});
