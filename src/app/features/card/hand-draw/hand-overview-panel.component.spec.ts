import { ComponentFixture, TestBed } from '@angular/core/testing';
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
});
