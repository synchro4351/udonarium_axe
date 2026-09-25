import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatMessageService } from '@axe/application/chat/chat-message.service';
import { CoordinateService } from '@axe/application/input/coordinate.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { TableFocusService } from '@axe/application/tabletop/table-focus.service';
import { ContextMenuService } from '@axe/application/ui/context-menu.service';
import { SelectionSignalService } from '@axe/application/ui/selection-signal.service';
import { Card, CardState } from '@axe/domain/card/card';
import { handLocationOf } from '@axe/domain/card/hand-location';
import { Config } from '@axe/domain/peer/config';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { HandRailComponent } from '@axe/features/card/hand-rail/hand-rail.component';
import { HandRailService } from '@axe/features/card/hand-rail/hand-rail.service';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('HandRailComponent', () => {
  let component: HandRailComponent;
  let fixture: ComponentFixture<HandRailComponent>;

  function makeCard(locationName: string): Card {
    const card = Card.create('カード', 'front.png', 'back.png');
    card.location.name = locationName;
    return card;
  }

  beforeEach(async () => {
    localStorage.removeItem('ui-hand-auto-sort');
    await TestBed.configureTestingModule({
      imports: [HandRailComponent],
      providers: [...TEST_PROVIDERS],
    }).compileComponents();
    fixture = TestBed.createComponent(HandRailComponent);
    component = fixture.componentInstance;
    PeerCursor.createMyCursor();
    PeerCursor.myCursor.userId = 'me';
    PeerCursor.myCursor.role = PeerRole.Player;
  });

  afterEach(() => {
    localStorage.removeItem('ui-hand-auto-sort');
    Config.instance.allowsHandDraw = true;
    Config.instance.allowsHandGive = true;
    PeerCursor.myCursor = null!;
  });

  it('lays out only the cards in your own hands', () => {
    const mine = makeCard(handLocationOf('me'));
    makeCard(handLocationOf('other'));
    makeCard('table');

    expect(component.cards()).toEqual([mine]);
  });

  it('leaves a card owned but left on the table out of the hand', () => {
    const peeked = makeCard('table');
    peeked.owner = 'me';

    expect(component.cards()).toEqual([]);
  });

  it('draws the rail only while it is open to somebody who may edit the table', async () => {
    const rail = TestBed.inject(HandRailService);

    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.hand-rail')).toBeNull();

    rail.open();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.hand-rail')).not.toBeNull();

    PeerCursor.myCursor.role = PeerRole.GameMaster;
    TestBed.inject(ObjectChangeService).notifyChanged(PeerCursor.myCursor.identifier);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.hand-rail')).not.toBeNull();

    PeerCursor.myCursor.role = PeerRole.Guest;
    TestBed.inject(ObjectChangeService).notifyChanged(PeerCursor.myCursor.identifier);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.hand-rail')).toBeNull();
  });

  it('draws the card text in your hand', async () => {
    const card = makeCard(handLocationOf('me'));
    card.faceText = '手札の文章';
    TestBed.inject(HandRailService).open();

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('card-face-preview')).toBeTruthy();
  });

  it('requires a second explicit action to open the hand and hides it immediately', () => {
    const controls = component as unknown as {
      toggleHandPublic: () => void;
      confirmHandPublic: () => void;
      confirmPublic: () => boolean;
    };
    expect(PeerCursor.myCursor.handPublic).toBe(false);

    controls.toggleHandPublic();
    expect(PeerCursor.myCursor.handPublic).toBe(false);
    expect(controls.confirmPublic()).toBe(true);
    controls.confirmHandPublic();
    expect(PeerCursor.myCursor.handPublic).toBe(true);
    controls.toggleHandPublic();
    expect(PeerCursor.myCursor.handPublic).toBe(false);
  });

  it('toggles hand visibility from the visible status itself', async () => {
    TestBed.inject(HandRailService).open();
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const status = () => root.querySelector<HTMLButtonElement>('[data-testid="hand-public-status"]')!;

    expect(status().tagName).toBe('BUTTON');
    expect(status().getAttribute('aria-pressed')).toBe('false');
    status().click();
    fixture.detectChanges();
    expect(PeerCursor.myCursor.handPublic).toBe(false);
    expect(status().getAttribute('aria-expanded')).toBe('true');

    root.querySelector<HTMLButtonElement>('[data-testid="hand-public-confirm"]')!.click();
    fixture.detectChanges();
    expect(PeerCursor.myCursor.handPublic).toBe(true);
    expect(status().getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('[data-testid="hand-public-confirm"]')).toBeNull();

    status().click();
    fixture.detectChanges();
    expect(PeerCursor.myCursor.handPublic).toBe(false);
    expect(root.querySelector('[data-testid="hand-public-confirm"]')).toBeNull();
  });

  it('keeps automatic sorting local and returns to manual order when rearranged', () => {
    const first = makeCard(handLocationOf('me'));
    const second = makeCard(handLocationOf('me'));
    first.handOrder = 0;
    second.handOrder = 1;
    const controls = component as unknown as {
      autoSort: () => boolean;
      toggleAutoSort: () => void;
      reorderTo: (card: Card, index: number) => void;
    };

    controls.toggleAutoSort();
    expect(controls.autoSort()).toBe(true);
    expect(localStorage.getItem('ui-hand-auto-sort')).toBe('true');

    controls.reorderTo(first, 2);
    expect(controls.autoSort()).toBe(false);
    expect(component.cards()).toEqual([second, first]);
  });

  it('marks the received card and shows its last giver when opened', async () => {
    const card = makeCard(handLocationOf('me'));
    card.lastHandGiverUserId = 'other';
    card.lastHandGiverName = 'あいて';
    TestBed.inject(HandRailService).open();
    fixture.detectChanges();
    await fixture.whenStable();

    const badge = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="hand-card-source"]'
    )!;
    expect(badge).toBeTruthy();
    badge.click();
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="hand-card-source-popup"]')?.textContent
    ).toContain('あいて');
  });

  it('offers another participant on a hand card context menu', () => {
    const other = new PeerCursor();
    other.userId = 'other';
    other.name = 'あいて';
    other.role = PeerRole.Player;
    other.initialize();
    const card = makeCard(handLocationOf('me'));
    const menu = TestBed.inject(ContextMenuService);
    const open = vi.spyOn(menu, 'open').mockImplementation(() => undefined);
    vi.spyOn(TestBed.inject(ChatMessageService), 'sendSystemMessage').mockImplementation(() => null!);

    try {
      (component as unknown as { openGiveMenu: (c: Card, e: MouseEvent) => void }).openGiveMenu(
        card,
        new MouseEvent('contextmenu', { clientX: 15, clientY: 25, cancelable: true })
      );

      expect(open).toHaveBeenCalledOnce();
      expect(open.mock.calls[0][1][0].name).toContain('あいて');
      open.mock.calls[0][1][0].action?.();
      expect(card.location.name).toBe(handLocationOf('other'));
    } finally {
      other.destroy();
      card.destroy();
    }
  });

  it('opens no give menu and disables the give and draw buttons while the room forbids them', async () => {
    const card = makeCard(handLocationOf('me'));
    const open = vi.spyOn(TestBed.inject(ContextMenuService), 'open').mockImplementation(() => undefined);
    Config.instance.allowsHandDraw = false;
    Config.instance.allowsHandGive = false;
    TestBed.inject(HandRailService).open();
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    try {
      (component as unknown as { openGiveMenu: (c: Card, e: MouseEvent) => void }).openGiveMenu(
        card,
        new MouseEvent('contextmenu', { cancelable: true })
      );
      (component as unknown as { hovered: { set: (id: string) => void } }).hovered.set(card.identifier);
      fixture.detectChanges();

      expect(open).not.toHaveBeenCalled();
      expect(root.querySelector<HTMLButtonElement>('[data-testid="hand-card-give"]')!.disabled).toBe(true);
      expect(root.querySelector<HTMLButtonElement>('[data-testid="hand-draw-open"]')!.disabled).toBe(true);
    } finally {
      card.destroy();
    }
  });

  it('puts a card face up back onto the table and out of the hand', () => {
    const card = makeCard(handLocationOf('me'));

    (component as unknown as { playFaceUp: (c: Card) => void }).playFaceUp(card);

    expect(card.location.name).toBe('table');
    expect(card.state).toBe(CardState.FRONT);
    expect(component.cards()).toEqual([]);
  });

  it('puts one face down back onto the table still hidden', () => {
    const card = makeCard(handLocationOf('me'));

    (component as unknown as { playFaceDown: (c: Card) => void }).playFaceDown(card);

    expect(card.location.name).toBe('table');
    expect(card.state).toBe(CardState.BACK);
    expect(card.owner).toBe('');
  });

  it('keeps a dropped card in hand until its face is chosen at the drop position', () => {
    const card = makeCard(handLocationOf('me'));
    const menu = TestBed.inject(ContextMenuService);
    const open = vi.spyOn(menu, 'open').mockImplementation(() => undefined);
    const surface = document.createElement('div');
    surface.dataset['surface'] = 'table';
    const originalElementsFromPoint = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint');
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [surface] });
    vi.spyOn(TestBed.inject(CoordinateService), 'calcTabletopLocalCoordinate').mockReturnValue({ x: 120, y: 90, z: 0 });
    const controls = component as unknown as {
      activePointerId: number;
      dragPending: { card: Card; startX: number; startY: number; dragging: boolean };
      onCardPointerUp: (event: PointerEvent) => void;
    };
    controls.activePointerId = 1;
    controls.dragPending = { card, startX: 0, startY: 0, dragging: true };

    try {
      controls.onCardPointerUp({
        pointerId: 1,
        clientX: 120,
        clientY: 90,
        currentTarget: document.createElement('div'),
      } as unknown as PointerEvent);

      expect(card.location.name).toBe(handLocationOf('me'));
      expect(open).toHaveBeenCalledOnce();
      expect(open.mock.calls[0][1]).toHaveLength(2);
      open.mock.calls[0][1][1].action?.();
      expect(card.location.name).toBe('table');
      expect(card.state).toBe(CardState.BACK);
    } finally {
      if (originalElementsFromPoint) Object.defineProperty(document, 'elementsFromPoint', originalElementsFromPoint);
      else Reflect.deleteProperty(document, 'elementsFromPoint');
    }
  });

  describe('dropping onto the hand overview', () => {
    let other: PeerCursor;
    let restoreElementsFromPoint: () => void;

    function dropOver(card: Card, elements: HTMLElement[], dragging = true) {
      const open = vi.spyOn(TestBed.inject(ContextMenuService), 'open').mockImplementation(() => undefined);
      Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => elements });
      const controls = component as unknown as {
        activePointerId: number;
        dragPending: { card: Card; startX: number; startY: number; dragging: boolean };
        onCardPointerUp: (event: PointerEvent) => void;
      };
      controls.activePointerId = 1;
      controls.dragPending = { card, startX: 0, startY: 0, dragging };
      controls.onCardPointerUp({
        pointerId: 1,
        clientX: 10,
        clientY: 10,
        currentTarget: document.createElement('div'),
      } as unknown as PointerEvent);
      return open;
    }

    function overviewSection(userId: string): HTMLElement {
      const host = document.createElement('hand-overview-panel');
      const section = document.createElement('section');
      section.setAttribute('data-hand-drop-user-id', userId);
      host.appendChild(section);
      return section;
    }

    beforeEach(() => {
      const original = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint');
      restoreElementsFromPoint = () => {
        if (original) Object.defineProperty(document, 'elementsFromPoint', original);
        else Reflect.deleteProperty(document, 'elementsFromPoint');
      };
      other = new PeerCursor();
      other.userId = 'other';
      other.name = 'あいて';
      other.role = PeerRole.Player;
      other.initialize();
      vi.spyOn(TestBed.inject(ChatMessageService), 'sendSystemMessage').mockImplementation(() => null!);
    });

    afterEach(() => {
      restoreElementsFromPoint();
      other.destroy();
      vi.restoreAllMocks();
    });

    it('gives exactly the dragged card to the participant it was dropped on', () => {
      const dragged = makeCard(handLocationOf('me'));
      const kept = makeCard(handLocationOf('me'));
      const surface = document.createElement('div');
      surface.dataset['surface'] = 'table';

      const open = dropOver(dragged, [overviewSection('other'), surface]);

      expect(dragged.location.name).toBe(handLocationOf('other'));
      expect(dragged.lastHandGiverUserId).toBe('me');
      expect(kept.location.name).toBe(handLocationOf('me'));
      expect(open).not.toHaveBeenCalled();
      dragged.destroy();
      kept.destroy();
    });

    it('keeps the card when dropped on your own section or on someone who has left', () => {
      const card = makeCard(handLocationOf('me'));
      const surface = document.createElement('div');
      surface.dataset['surface'] = 'table';

      const open = dropOver(card, [overviewSection('me'), surface]);
      dropOver(card, [overviewSection('gone'), surface]);

      expect(card.location.name).toBe(handLocationOf('me'));
      expect(open).not.toHaveBeenCalled();
      card.destroy();
    });

    it('keeps the card, with no face menu, when dropped on a section while the room forbids giving', () => {
      const card = makeCard(handLocationOf('me'));
      const surface = document.createElement('div');
      surface.dataset['surface'] = 'table';
      Config.instance.allowsHandGive = false;

      const open = dropOver(card, [overviewSection('other'), surface]);

      expect(card.location.name).toBe(handLocationOf('me'));
      expect(card.lastHandGiverUserId).toBe('');
      expect(open).not.toHaveBeenCalled();
      card.destroy();
    });

    it('does not give a card on a plain click over a section', () => {
      const card = makeCard(handLocationOf('me'));

      dropOver(card, [overviewSection('other')], false);

      expect(card.location.name).toBe(handLocationOf('me'));
      card.destroy();
    });
  });

  it('moves the view to the card just played', () => {
    const card = makeCard(handLocationOf('me'));
    card.location.x = 120;
    card.location.y = 80;
    const selection = TestBed.inject(SelectionSignalService);

    (component as unknown as { playFaceUp: (c: Card) => void }).playFaceUp(card);

    expect(selection.focusCoordinate()).toEqual(expect.objectContaining({ x: 120, y: 80 }));
  });

  it('looks for the card just played where it stands, through the table focus', () => {
    const card = makeCard(handLocationOf('me'));
    const focusOn = vi.spyOn(TestBed.inject(TableFocusService), 'focusOn').mockImplementation(() => undefined);

    (component as unknown as { playFaceUp: (c: Card) => void }).playFaceUp(card);

    expect(focusOn).toHaveBeenCalledWith(card);
  });
});
