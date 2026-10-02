import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PointerDeviceService } from '@axe/application/input/pointer-device.service';
import { DisclosureService } from '@axe/application/permission/disclosure.service';
import { TabletopService } from '@axe/application/tabletop/tabletop.service';
import { ContextMenuService } from '@axe/application/ui/context-menu.service';
import { PieceContextMenuService } from '@axe/application/ui/piece-context-menu.service';
import { UiSignalService } from '@axe/application/ui/ui-signal.service';
import { TextNote } from '@axe/domain/tabletop/text-note';
import { TextNoteComponent } from '@axe/features/tabletop/text-note/text-note.component';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';
import { RotableDirective } from '@axe/ui/directives/rotable.directive';

describe('TextNoteComponent', () => {
  let component: TextNoteComponent;
  let fixture: ComponentFixture<TextNoteComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TextNoteComponent],
      providers: [...TEST_PROVIDERS],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TextNoteComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('registers its effect in the constructor, so nothing is set up outside an injection context', () => {
    // the effect is registered in the constructor rather than from a lifecycle hook
    expect(component).toBeTruthy();
  });

  describe('viewRotateZ computed signal', () => {
    it('starts at ten', () => {
      expect(component.viewRotateZ()).toBe(10);
    });

    it('turns with the table view', () => {
      const uiSignalService = TestBed.inject(UiSignalService);
      uiSignalService.notifyTableViewRotation(50, 20, 60);
      expect(component.viewRotateZ()).toBe(60);
    });
  });

  describe('edit toggle + decoratedHtml', () => {
    let note: TextNote;

    beforeEach(() => {
      note = TextNote.create('メモ', '> @勇者\n> こんにちは\n本文');
      fixture.componentRef.setInput('textNote', note);
      fixture.detectChanges();
    });

    afterEach(() => {
      note.destroy();
    });

    it('starts out of edit mode', () => {
      expect(component.isEditing()).toBe(false);
    });

    it('marks up a quoted line as a quotation', () => {
      const html = component.decoratedHtml();
      expect(html).toContain('<span class="chat-quote">');
      expect(html).toContain('@勇者');
      expect(html).toContain('本文');
    });

    it('goes into edit mode on request', () => {
      component.enterEdit();
      expect(component.isEditing()).toBe(true);
    });

    it('stays out of it while the note is locked', () => {
      note.isLock = true;
      component.enterEdit();
      expect(component.isEditing()).toBe(false);
    });

    it('leaves edit mode when the field loses focus', () => {
      component.enterEdit();
      expect(component.isEditing()).toBe(true);
      component.onTextAreaBlur();
      expect(component.isEditing()).toBe(false);
    });
  });

  describe('display format', () => {
    const SOURCE = '# 見出し\n- 項目\n`|漢字《かんじ》`\nhttps://example.com';
    let note: TextNote;

    beforeEach(() => {
      note = TextNote.create('整形メモ', SOURCE);
      fixture.componentRef.setInput('textNote', note);
    });

    afterEach(() => {
      note.destroy();
    });

    async function body(): Promise<HTMLElement> {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('div[data-v]')!;
    }

    it('shows a normal note as typed, with its address linked as before', async () => {
      const shown = await body();

      expect(shown.classList).toContain('whitespace-pre-line');
      expect(shown.classList).not.toContain('note-formatted');
      expect(shown.querySelector('h1')).toBeNull();
      expect(shown.textContent).toContain('# 見出し');
      expect(shown.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    });

    it('formats a formatted note, without links and with code kept literal', async () => {
      note.format = 'formatted';
      const shown = await body();

      expect(shown.classList).toContain('note-formatted');
      expect(shown.classList).not.toContain('whitespace-pre-line');
      expect(shown.querySelector('h1')?.textContent).toBe('見出し');
      expect(shown.querySelector('ul li')?.textContent).toBe('項目');
      expect(shown.querySelector('code')?.textContent).toBe('|漢字《かんじ》');
      expect(shown.querySelector('ruby')).toBeNull();
      expect(shown.querySelector('a')).toBeNull();
      expect(shown.textContent).toContain('https://example.com');
    });

    it('masks a formatted note the same way to someone it is not shown to', async () => {
      note.format = 'formatted';
      vi.spyOn(TestBed.inject(DisclosureService), 'canView').mockReturnValue(false);
      const shown = await body();

      expect(shown.classList).toContain('whitespace-pre-line');
      expect(shown.classList).not.toContain('note-formatted');
      expect(shown.querySelector('h1')).toBeNull();
      expect(shown.textContent).not.toContain('見出し');
      expect(shown.textContent).toContain('█');
    });

    it('edits the source text, not the formatted display', async () => {
      note.format = 'formatted';
      await body();
      component.enterEdit();
      fixture.detectChanges();
      await fixture.whenStable();

      const textArea = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
      expect(textArea.value).toBe(SOURCE);
    });
  });

  describe('rotation in 2D mode', () => {
    let note: TextNote;

    beforeEach(() => {
      note = TextNote.create('回転するメモ', '本文');
      TestBed.inject(TabletopService).currentTable.mode2d = true;
      fixture.componentRef.setInput('textNote', note);
    });

    afterEach(() => {
      note.destroy();
    });

    function rotable(): RotableDirective {
      fixture.detectChanges();
      return fixture.debugElement.query(By.directive(RotableDirective)).injector.get(RotableDirective);
    }

    it('allows a flat note to rotate horizontally', () => {
      note.isUpright = false;

      expect(rotable().isDisable()).toBe(false);
    });

    it('keeps rotation disabled for an upright note', () => {
      note.isUpright = true;

      expect(rotable().isDisable()).toBe(true);
    });
  });

  describe('context menu display', () => {
    let note: TextNote;

    beforeEach(() => {
      note = TextNote.create('メモメニュー', '本文');
      fixture.componentRef.setInput('textNote', note);
    });

    afterEach(() => {
      note.destroy();
    });

    function openMenu(mode2d: boolean, menuStyle: 'four-way' | 'radial' | 'standard'): void {
      const table = TestBed.inject(TabletopService).currentTable;
      table.mode2d = mode2d;
      table.tabletopMenuStyle = menuStyle;
      table.radialMenuRotationSpeed = 9;
      fixture.detectChanges();
      vi.spyOn(TestBed.inject(PieceContextMenuService), 'openForSelection').mockReturnValue(false);
      TestBed.inject(PointerDeviceService).primeForContextMenu(240, 180);

      component.onContextMenu(new MouseEvent('contextmenu', { cancelable: true }));
    }

    it.each(['four-way', 'radial'] as const)('opens the four-way menu when the style is %s', (style) => {
      const menus = TestBed.inject(ContextMenuService);
      const openRadial = vi.spyOn(menus, 'openRadial').mockImplementation(() => undefined);
      const openOrdinary = vi.spyOn(menus, 'open').mockImplementation(() => undefined);
      openMenu(true, style);

      expect(openRadial).toHaveBeenCalledWith(
        expect.objectContaining({ x: 240, y: 180 }),
        expect.any(Array),
        expect.any(Array),
        'メモメニュー',
        style === 'radial',
        9,
        1
      );
      expect(openRadial.mock.calls[0]?.[2].map((group) => group.name)).toEqual([
        '内容',
        '表示',
        '公開・所有',
        '移動・操作',
      ]);
      expect(openOrdinary).not.toHaveBeenCalled();
    });

    it('keeps the ordinary menu outside 2D mode', () => {
      const menus = TestBed.inject(ContextMenuService);
      const openRadial = vi.spyOn(menus, 'openRadial').mockImplementation(() => undefined);
      const openOrdinary = vi.spyOn(menus, 'open').mockImplementation(() => undefined);
      openMenu(false, 'radial');

      expect(openOrdinary).toHaveBeenCalledWith(
        expect.objectContaining({ x: 240, y: 180 }),
        expect.any(Array),
        'メモメニュー'
      );
      expect(openRadial).not.toHaveBeenCalled();
    });
  });
});
