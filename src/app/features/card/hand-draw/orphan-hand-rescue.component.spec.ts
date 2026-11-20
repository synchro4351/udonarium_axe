import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardGameService } from '@axe/application/card/card-game.service';
import { ChatMessageService } from '@axe/application/chat/chat-message.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ConfirmService } from '@axe/application/ui/confirm.service';
import { ConfirmDialogOption } from '@axe/application/ui/confirm-option';
import { IPeerContext } from '@axe/core/network/peer-context';
import { resetPeerContextProvider, setPeerContextProvider } from '@axe/core/network/peer-context-source';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Card } from '@axe/domain/card/card';
import { handLocationOf } from '@axe/domain/card/hand-location';
import { Config } from '@axe/domain/peer/config';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { OrphanHandRescueComponent } from '@axe/features/card/hand-draw/orphan-hand-rescue.component';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('OrphanHandRescueComponent', () => {
  const ABSENT = 'absent-user-0123456789';
  let fixture: ComponentFixture<OrphanHandRescueComponent>;
  let ask: ReturnType<typeof vi.fn>;
  const created: { destroy(): void }[] = [];

  function secretCard(name: string, userId: string, handOrder: number): Card {
    const card = Card.create(name, './assets/images/trump/s01.webp', './assets/images/trump/z01.webp');
    card.toHand(userId, handOrder);
    created.push(card);
    return card;
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

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function render(): void {
    TestBed.inject(ObjectChangeService).notifyChanged(PeerCursor.myCursor.identifier);
    fixture.detectChanges();
  }

  function pickRecipient(userId: string): void {
    const select = root().querySelector<HTMLSelectElement>('[data-testid="orphan-hand-recipient"]')!;
    select.value = userId;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  async function pressMove(): Promise<void> {
    root().querySelector<HTMLButtonElement>('[data-testid="orphan-hand-move"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    for (const cursor of ObjectStore.instance.getObjects<PeerCursor>(PeerCursor)) {
      ObjectStore.instance.delete(cursor, false);
    }
    PeerCursor.myCursor = null!;
    PeerCursor.createMyCursor();
    PeerCursor.myCursor.userId = 'me';
    PeerCursor.myCursor.peerId = 'peer-me';
    PeerCursor.myCursor.name = 'ゲームマスター';
    PeerCursor.myCursor.role = PeerRole.GameMaster;
    setPeerContextProvider({
      peerContext: { userId: 'me', peerId: 'peer-me' } as IPeerContext,
      peerContexts: [],
      peerIds: ['peer-other'],
      peerId: 'peer-me',
    });
    TestBed.configureTestingModule({ imports: [OrphanHandRescueComponent], providers: [...TEST_PROVIDERS] });
    vi.spyOn(TestBed.inject(ChatMessageService), 'sendSystemMessage').mockReturnValue(null!);
    ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true) as unknown as ReturnType<
      typeof vi.fn
    >;
    fixture = TestBed.createComponent(OrphanHandRescueComponent);
  });

  afterEach(() => {
    fixture?.destroy();
    resetPeerContextProvider();
    Config.instance.handVisibilityMode = 'choice';
    vi.restoreAllMocks();
    for (const object of created.splice(0)) object.destroy();
    for (const cursor of ObjectStore.instance.getObjects<PeerCursor>(PeerCursor)) {
      if (cursor !== PeerCursor.myCursor) ObjectStore.instance.delete(cursor, false);
    }
  });

  it('shows nothing to a player or a guest', () => {
    peer('other', 'あいて');
    secretCard('ひみつA', ABSENT, 1);

    for (const role of [PeerRole.Player, PeerRole.Guest]) {
      PeerCursor.myCursor.role = role;
      render();
      expect(root().querySelector('[data-testid="orphan-hands"]')).toBeNull();
    }
  });

  it('shows nothing while every hand has its holder in the room', () => {
    peer('other', 'あいて');
    secretCard('ひみつA', 'other', 1);
    render();

    expect(root().querySelector('[data-testid="orphan-hands"]')).toBeNull();
  });

  it('lists each orphaned hand folded away, by a short id and count, showing only card backs', () => {
    peer('other', 'あいて');
    secretCard('ひみつA', ABSENT, 1);
    secretCard('ひみつB', ABSENT, 2);
    secretCard('ひみつC', 'zz-other-absent', 1);
    // Even a room that makes every hand public does not open an orphaned one here.
    Config.instance.handVisibilityMode = 'public';
    render();

    const details = root().querySelector<HTMLDetailsElement>('[data-testid="orphan-hands"]')!;
    expect(details.open).toBe(false);
    const hands = root().querySelectorAll('[data-testid="orphan-hand"]');
    expect(hands).toHaveLength(2);
    expect(hands[0].querySelectorAll('[data-testid="orphan-hand-card"] img')).toHaveLength(2);
    expect(hands[0].querySelector('[data-testid="orphan-hand-label"]')?.textContent).toContain('absent…');
    expect(root().textContent).not.toContain(ABSENT);
    expect(root().textContent).not.toContain('ひみつ');
    expect(root().querySelector('card-face-preview')).toBeNull();
    expect(root().querySelector('[title]')).toBeNull();
    for (const image of Array.from(root().querySelectorAll('img'))) {
      expect(image.getAttribute('src')).not.toContain('s01');
    }
  });

  it('offers only connected card holders and says so when nobody can take the hand', () => {
    peer('other', 'あいて');
    peer('dropping', 'きれかけ');
    peer('guest', 'けんがく', PeerRole.Guest);
    secretCard('ひみつA', ABSENT, 1);
    render();

    const options = Array.from(
      root().querySelectorAll<HTMLOptionElement>('[data-testid="orphan-hand-recipient"] option')
    );
    expect(options.map((option) => option.value)).toEqual(['', 'me', 'other']);
    expect(root().querySelector<HTMLButtonElement>('[data-testid="orphan-hand-move"]')!.disabled).toBe(true);

    fixture.destroy();
    vi.spyOn(TestBed.inject(CardGameService), 'orphanHandRecipients').mockReturnValue([]);
    fixture = TestBed.createComponent(OrphanHandRescueComponent);
    render();
    expect(root().querySelector('[data-testid="orphan-hand-recipient"]')).toBeNull();
    expect(root().querySelector('[data-testid="orphan-hand-no-recipient"]')).toBeTruthy();
  });

  it('moves nothing until the move is confirmed', async () => {
    peer('other', 'あいて');
    const card = secretCard('ひみつA', ABSENT, 1);
    render();
    ask.mockResolvedValue(false);

    pickRecipient('other');
    await pressMove();

    expect(ask).toHaveBeenCalledOnce();
    expect(card.location.name).toBe(handLocationOf(ABSENT));
  });

  it('moves the whole hand to the chosen participant once confirmed, naming no card', async () => {
    peer('other', 'あいて');
    const first = secretCard('ひみつA', ABSENT, 1);
    const second = secretCard('ひみつB', ABSENT, 2);
    render();

    pickRecipient('other');
    await pressMove();

    const option = ask.mock.calls[0][0] as ConfirmDialogOption;
    expect(option.message).toContain('あいて');
    expect(option.message).toContain('2');
    expect(option.message).not.toContain('ひみつ');
    expect(option.message).not.toContain('公開中');
    expect(first.location.name).toBe(handLocationOf('other'));
    expect(second.location.name).toBe(handLocationOf('other'));
    expect(root().querySelector('[data-testid="orphan-hands"]')).toBeNull();
  });

  it('warns before moving into a hand that is public', async () => {
    const other = peer('other', 'あいて');
    other.handPublic = true;
    secretCard('ひみつA', ABSENT, 1);
    render();

    pickRecipient('other');
    await pressMove();

    expect((ask.mock.calls[0][0] as ConfirmDialogOption).message).toContain('公開中');
  });

  it('moves nothing and says why when the hand changed while the dialog was open', async () => {
    peer('other', 'あいて');
    const card = secretCard('ひみつA', ABSENT, 1);
    render();
    let late: Card | null = null;
    ask.mockImplementation(async () => {
      late = secretCard('ひみつB', ABSENT, 2);
      return true;
    });

    pickRecipient('other');
    await pressMove();

    expect(card.location.name).toBe(handLocationOf(ABSENT));
    expect(late!.location.name).toBe(handLocationOf(ABSENT));
    expect(root().querySelector('[data-testid="orphan-hand-outcome"]')?.textContent).toContain('手札の中身が変わった');
  });
});
