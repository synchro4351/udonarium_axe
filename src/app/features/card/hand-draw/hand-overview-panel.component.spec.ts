import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatMessageService } from '@axe/application/chat/chat-message.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Card } from '@axe/domain/card/card';
import { handLocationOf } from '@axe/domain/card/hand-location';
import { Config } from '@axe/domain/peer/config';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { HandOverviewPanelComponent } from '@axe/features/card/hand-draw/hand-overview-panel.component';
import { HandDragService } from '@axe/features/card/hand-rail/hand-drag.service';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('HandOverviewPanelComponent', () => {
  let fixture: ComponentFixture<HandOverviewPanelComponent>;
  let component: HandOverviewPanelComponent;
  const created: { destroy(): void }[] = [];

  function card(code: string, userId: string): Card {
    const object = Card.create('カード', `./assets/images/trump/${code}.webp`, './assets/images/trump/z01.webp');
    object.toHand(userId);
    created.push(object);
    return object;
  }

  function peer(userId: string, name: string, role: PeerRole = PeerRole.Player): PeerCursor {
    const cursor = new PeerCursor();
    cursor.userId = userId;
    cursor.peerId = `peer-${userId}`;
    cursor.name = name;
    cursor.role = role;
    cursor.initialize();
    created.push(cursor);
    return cursor;
  }

  function sectionOf(userId: string): HTMLElement {
    const root = fixture.nativeElement as HTMLElement;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-testid="hand-overview-section"]'));
    return sections[component.sections().findIndex((section) => section.userId === userId)];
  }

  beforeEach(() => {
    PeerCursor.createMyCursor();
    PeerCursor.myCursor.userId = 'me';
    PeerCursor.myCursor.name = 'わたし';
    PeerCursor.myCursor.role = PeerRole.Player;
    TestBed.configureTestingModule({ imports: [HandOverviewPanelComponent], providers: [...TEST_PROVIDERS] });
    fixture = TestBed.createComponent(HandOverviewPanelComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.inject(HandDragService).end();
    Config.instance.allowsHandGive = true;
    Config.instance.handVisibilityMode = 'choice';
    for (const object of created.splice(0)) object.destroy();
    for (const cursor of ObjectStore.instance.getObjects<PeerCursor>(PeerCursor)) {
      if (cursor !== PeerCursor.myCursor) ObjectStore.instance.delete(cursor, false);
    }
  });

  it('lists every participant who may hold cards at once, including empty hands', () => {
    peer('other', 'あいて');
    peer('empty', 'てふだなし');
    peer('guest', 'けんがく', PeerRole.Guest);
    card('s01', 'other');
    card('h05', 'me');
    fixture.detectChanges();

    const sections = component.sections();
    expect(sections.map((section) => section.userId).sort()).toEqual(['empty', 'me', 'other']);
    expect(sections.find((section) => section.userId === 'other')?.cards).toHaveLength(1);
    expect(sections.find((section) => section.userId === 'empty')?.cards).toHaveLength(0);
    expect(sections.find((section) => section.userId === 'me')?.isSelf).toBe(true);
  });

  it('shows fronts only for public hands and backs for private ones', () => {
    const open = peer('open', 'こうかい');
    peer('closed', 'ひとく');
    card('s01', 'open');
    card('s02', 'closed');
    card('s03', 'closed');
    open.handPublic = true;
    fixture.detectChanges();

    expect(sectionOf('open').querySelectorAll('card-face-preview')).toHaveLength(1);
    expect(sectionOf('closed').querySelector('card-face-preview')).toBeNull();
    expect(sectionOf('closed').querySelectorAll('img')).toHaveLength(2);
    expect(sectionOf('closed').querySelector('[title]')).toBeNull();
  });

  it('follows a participant opening and hiding their hand', () => {
    const other = peer('other', 'あいて');
    card('s01', 'other');
    fixture.detectChanges();
    expect(sectionOf('other').querySelector('card-face-preview')).toBeNull();

    other.handPublic = true;
    TestBed.inject(ObjectChangeService).notifyChanged(other.identifier);
    fixture.detectChanges();
    expect(sectionOf('other').querySelector('card-face-preview')).toBeTruthy();

    other.handPublic = false;
    TestBed.inject(ObjectChangeService).notifyChanged(other.identifier);
    fixture.detectChanges();
    expect(sectionOf('other').querySelector('card-face-preview')).toBeNull();
  });

  it('shows only backs when the room forces private hands, even if a cursor is public', () => {
    const other = peer('other', 'あいて');
    card('s01', 'other');
    other.handPublic = true;
    Config.instance.handVisibilityMode = 'private';
    fixture.detectChanges();

    expect(sectionOf('other').querySelector('card-face-preview')).toBeNull();
    expect(sectionOf('other').querySelector('[title]')).toBeNull();
  });

  it('only views: clicking a card leaves it in its hand', () => {
    const other = peer('other', 'あいて');
    const held = card('s01', 'other');
    other.handPublic = true;
    fixture.detectChanges();

    expect(sectionOf('other').querySelector('button')).toBeNull();
    sectionOf('other').querySelector<HTMLElement>('[data-testid="hand-overview-card"]')!.click();
    expect(held.location.name).toBe(handLocationOf('other'));
  });

  it('marks other participants as drop targets while a hand card is dragged, never yourself', () => {
    peer('other', 'あいて');
    const mine = card('h01', 'me');
    fixture.detectChanges();

    expect(sectionOf('other').getAttribute('data-hand-drop-user-id')).toBe('other');
    expect(sectionOf('me').hasAttribute('data-hand-drop-user-id')).toBe(false);
    expect(sectionOf('other').querySelector('[data-testid="hand-overview-drop-hint"]')).toBeNull();

    TestBed.inject(HandDragService).begin(mine);
    fixture.detectChanges();
    expect(sectionOf('other').querySelector('[data-testid="hand-overview-drop-hint"]')).toBeTruthy();
    expect(sectionOf('me').querySelector('[data-testid="hand-overview-drop-hint"]')).toBeNull();
  });

  it('takes no dropped card while the room forbids giving, and follows the setting as it changes', () => {
    peer('other', 'あいて');
    const mine = card('h01', 'me');
    Config.instance.allowsHandGive = false;
    TestBed.inject(HandDragService).begin(mine);
    fixture.detectChanges();

    expect(sectionOf('other').hasAttribute('data-hand-drop-user-id')).toBe(false);
    expect(sectionOf('other').querySelector('[data-testid="hand-overview-drop-hint"]')).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="hand-overview-hint"]')?.textContent
    ).toContain('この部屋ではカードを渡せません');

    Config.instance.allowsHandGive = true;
    TestBed.inject(ObjectChangeService).notifyChanged('Config');
    fixture.detectChanges();
    expect(sectionOf('other').getAttribute('data-hand-drop-user-id')).toBe('other');
    expect(sectionOf('other').querySelector('[data-testid="hand-overview-drop-hint"]')).toBeTruthy();
  });

  describe('drawing by dragging onto your own section', () => {
    let restoreElementsFromPoint: () => void;
    let under: Element[];

    function cardElementOf(userId: string, index = 0): HTMLElement {
      return sectionOf(userId).querySelectorAll<HTMLElement>('[data-testid="hand-overview-card"]')[index];
    }

    function pointer(target: HTMLElement, type: string, x: number, y: number): void {
      target.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
      );
      fixture.detectChanges();
    }

    /** Presses a card and carries it far enough to count as a drag, leaving it held. */
    function pickUp(element: HTMLElement): void {
      pointer(element, 'pointerdown', 0, 0);
      pointer(element, 'pointermove', 40, 40);
    }

    beforeEach(() => {
      vi.spyOn(TestBed.inject(ChatMessageService), 'sendSystemMessage').mockReturnValue(null!);
      vi.spyOn(component, 'frontImageUrl').mockReturnValue('front.png');
      vi.spyOn(component, 'backImageUrl').mockReturnValue('back.png');
      const original = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint');
      restoreElementsFromPoint = () => {
        if (original) Object.defineProperty(document, 'elementsFromPoint', original);
        else Reflect.deleteProperty(document, 'elementsFromPoint');
      };
      under = [];
      Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => under });
    });

    afterEach(() => {
      restoreElementsFromPoint();
      Config.instance.allowsHandDraw = true;
      PeerCursor.myCursor.role = PeerRole.Player;
      TestBed.inject(HandDragService).endDraw();
    });

    it('takes a face-down card from another hand into yours, showing only its back while carried', () => {
      peer('other', 'あいて');
      const held = card('s01', 'other');
      fixture.detectChanges();
      const drag = TestBed.inject(HandDragService);
      const element = cardElementOf('other');

      pickUp(element);
      expect(drag.drawCard()).toBe(held);
      expect(drag.drawImageUrl()).toBe('back.png');
      expect(sectionOf('me').querySelector('[data-testid="hand-overview-draw-drop-hint"]')).toBeTruthy();
      expect(sectionOf('other').querySelector('card-face-preview')).toBeNull();

      under = [sectionOf('me')];
      pointer(element, 'pointerup', 40, 40);

      expect(held.location.name).toBe(handLocationOf('me'));
      expect(TestBed.inject(ChatMessageService).sendSystemMessage).toHaveBeenCalledWith(
        expect.stringContaining('あいて')
      );
      expect(drag.drawCard()).toBeNull();
      expect(drag.drawImageUrl()).toBe('');
    });

    it('does not draw when released outside your section or over a window covering it', () => {
      peer('other', 'あいて');
      const held = card('s01', 'other');
      fixture.detectChanges();

      pickUp(cardElementOf('other'));
      under = [sectionOf('other')];
      pointer(cardElementOf('other'), 'pointerup', 40, 40);
      expect(held.location.name).toBe(handLocationOf('other'));

      pickUp(cardElementOf('other'));
      under = [document.createElement('div'), sectionOf('me')];
      pointer(cardElementOf('other'), 'pointerup', 40, 40);
      expect(held.location.name).toBe(handLocationOf('other'));
      expect(TestBed.inject(HandDragService).drawCard()).toBeNull();
    });

    it('does not draw on a click without dragging', () => {
      peer('other', 'あいて');
      const held = card('s01', 'other');
      fixture.detectChanges();
      under = [sectionOf('me')];

      pointer(cardElementOf('other'), 'pointerdown', 0, 0);
      pointer(cardElementOf('other'), 'pointerup', 2, 2);

      expect(held.location.name).toBe(handLocationOf('other'));
    });

    it('never lets you pick up a card from your own hand to draw it', () => {
      peer('other', 'あいて');
      const mine = card('h01', 'me');
      fixture.detectChanges();

      expect(cardElementOf('me').hasAttribute('data-hand-draw-card')).toBe(false);
      expect(cardElementOf('me').classList.contains('touch-none')).toBe(false);
      pickUp(cardElementOf('me'));
      expect(TestBed.inject(HandDragService).drawCard()).toBeNull();
      expect(mine.location.name).toBe(handLocationOf('me'));
    });

    it('offers no drawing while the room forbids it, and follows the setting as it changes', () => {
      peer('other', 'あいて');
      const held = card('s01', 'other');
      Config.instance.allowsHandDraw = false;
      fixture.detectChanges();
      const hint = () =>
        (fixture.nativeElement as HTMLElement).querySelector('[data-testid="hand-overview-draw-hint"]')?.textContent;

      expect(hint()).toContain('この部屋では他の人の手札から引けません');
      expect(sectionOf('me').hasAttribute('data-hand-draw-target')).toBe(false);
      expect(cardElementOf('other').hasAttribute('data-hand-draw-card')).toBe(false);
      pickUp(cardElementOf('other'));
      expect(TestBed.inject(HandDragService).drawCard()).toBeNull();
      under = [sectionOf('me')];
      pointer(cardElementOf('other'), 'pointerup', 40, 40);
      expect(held.location.name).toBe(handLocationOf('other'));

      Config.instance.allowsHandDraw = true;
      TestBed.inject(ObjectChangeService).notifyChanged('Config');
      fixture.detectChanges();
      expect(hint()).toContain('自分の欄へドラッグ');
      expect(sectionOf('me').getAttribute('data-hand-draw-target')).toBe('me');
      expect(cardElementOf('other').hasAttribute('data-hand-draw-card')).toBe(true);
    });

    it('drops a drag in progress when the room forbids drawing before it is released', () => {
      peer('other', 'あいて');
      const held = card('s01', 'other');
      fixture.detectChanges();

      pickUp(cardElementOf('other'));
      Config.instance.allowsHandDraw = false;
      TestBed.inject(ObjectChangeService).notifyChanged('Config');
      fixture.detectChanges();
      expect(TestBed.inject(HandDragService).drawCard()).toBeNull();

      under = [sectionOf('me')];
      pointer(cardElementOf('other'), 'pointerup', 40, 40);
      expect(held.location.name).toBe(handLocationOf('other'));
    });

    it('offers no drawing to a guest, who holds no hand', () => {
      peer('other', 'あいて');
      card('s01', 'other');
      PeerCursor.myCursor.role = PeerRole.Guest;
      TestBed.inject(ObjectChangeService).notifyChanged(PeerCursor.myCursor.identifier);
      fixture.detectChanges();

      expect(cardElementOf('other').hasAttribute('data-hand-draw-card')).toBe(false);
      pickUp(cardElementOf('other'));
      expect(TestBed.inject(HandDragService).drawCard()).toBeNull();
    });

    it('lets go of the card when it leaves that hand while carried', () => {
      peer('other', 'あいて');
      peer('third', 'さんにんめ');
      const held = card('s01', 'other');
      fixture.detectChanges();
      const element = cardElementOf('other');

      pickUp(element);
      held.toHand('third');
      TestBed.inject(ObjectChangeService).notifyChanged(held.identifier);
      fixture.detectChanges();
      expect(TestBed.inject(HandDragService).drawCard()).toBeNull();

      under = [sectionOf('me')];
      pointer(element, 'pointerup', 40, 40);
      expect(held.location.name).toBe(handLocationOf('third'));
    });

    it('shows the front while carried only as long as the hand stays public', () => {
      const other = peer('other', 'あいて');
      const held = card('s01', 'other');
      other.handPublic = true;
      fixture.detectChanges();
      const drag = TestBed.inject(HandDragService);

      pickUp(cardElementOf('other'));
      expect(drag.drawCard()).toBe(held);
      expect(drag.drawImageUrl()).toBe('front.png');

      other.handPublic = false;
      TestBed.inject(ObjectChangeService).notifyChanged(other.identifier);
      fixture.detectChanges();
      expect(drag.drawImageUrl()).toBe('back.png');
    });
  });
});
