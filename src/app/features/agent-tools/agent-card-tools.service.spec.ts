import { TestBed } from '@angular/core/testing';
import { ChatMessageService } from '@axe/application/chat/chat-message.service';
import { AgentToolError } from '@axe/core/agent/agent-error';
import { Network } from '@axe/core/network/network';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Card, CardState } from '@axe/domain/card/card';
import { CardStack } from '@axe/domain/card/card-stack';
import { handLocationOf } from '@axe/domain/card/hand-location';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { Config } from '@axe/domain/peer/config';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { AgentCardTools } from '@axe/features/agent-tools/agent-card-tools.service';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

const signal = new AbortController().signal;

describe('AgentCardTools', () => {
  let tools: AgentCardTools;
  let linked: string[];
  const created: { destroy(): void }[] = [];

  async function call(tool: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return (await tools.handlers[tool](args, { signal })) as Record<string, unknown>;
  }

  function card(name: string): Card {
    const made = Card.create(name, `./front-${name}.webp`, './back.webp');
    created.push(made);
    return made;
  }

  function deckOf(...names: string[]): CardStack {
    const deck = CardStack.create('山札');
    deck.location.name = 'table';
    for (const name of names) deck.putOnBottom(card(name));
    created.push(deck);
    return deck;
  }

  function peer(userId: string, name: string): PeerCursor {
    const cursor = new PeerCursor();
    cursor.userId = userId;
    cursor.peerId = `peer-${userId}`;
    linked.push(cursor.peerId);
    cursor.name = name;
    cursor.role = PeerRole.Player;
    cursor.initialize();
    created.push(cursor);
    return cursor;
  }

  beforeEach(() => {
    for (const cursor of ObjectStore.instance.getObjects<PeerCursor>(PeerCursor)) {
      ObjectStore.instance.delete(cursor, false);
    }
    PeerCursor.myCursor = null!;
    PeerCursor.createMyCursor();
    PeerCursor.myCursor.userId = 'me';
    PeerCursor.myCursor.name = 'AI';
    PeerCursor.myCursor.role = PeerRole.Player;
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    linked = [];
    vi.spyOn(Network, 'peerIds', 'get').mockImplementation(() => [...linked]);
    vi.spyOn(TestBed.inject(ChatMessageService), 'sendSystemNotice').mockReturnValue(null as unknown as ChatMessage);
    tools = TestBed.inject(AgentCardTools);
  });

  afterEach(() => {
    Config.instance.allowsHandDraw = true;
    Config.instance.allowsHandGive = true;
    vi.restoreAllMocks();
    for (const object of created.splice(0)) object.destroy();
  });

  it('draws from a deck into its own hand, face down, and is shown the faces it drew', async () => {
    const deck = deckOf('A', 'B', 'C');

    const result = await call('draw_card', { deck: '山札', count: 2 });

    expect(result['left']).toBe(1);
    const drawn = result['drawn'] as { id: string; name: string | null }[];
    expect(drawn.map((one) => one.name)).toEqual(['A', 'B']);
    for (const { id } of drawn) {
      const one = ObjectStore.instance.get<Card>(id)!;
      expect(one.location.name).toBe(handLocationOf('me'));
      expect(one.state).toBe(CardState.BACK);
    }
    expect(deck.cards).toHaveLength(1);
  });

  it("lists another seat's hand by count alone, never its faces", async () => {
    peer('pl', 'プレイヤー');
    card('秘密').toHand('pl');
    card('自分の').toHand('me');

    const hands = (await call('list_cards'))['hands'] as { holder: string; count: number; cards?: unknown[] }[];

    const theirs = hands.find((hand) => hand.holder === 'プレイヤー')!;
    expect(theirs.count).toBe(1);
    expect(theirs.cards).toBeUndefined();
    const mine = hands.find((hand) => hand.holder === 'AI')!;
    expect(mine.cards).toEqual([expect.objectContaining({ name: '自分の' })]);
  });

  it('gives a card from its hand to another seat, face down', async () => {
    peer('pl', 'プレイヤー');
    const given = card('渡す');
    given.toHand('me');

    await call('give_card', { card: given.identifier, to: 'プレイヤー' });

    expect(given.location.name).toBe(handLocationOf('pl'));
  });

  it("keeps to the room's switch on giving from the table", async () => {
    peer('pl', 'プレイヤー');
    Config.instance.allowsHandGive = false;
    const loose = card('場');
    loose.location.name = 'table';

    await expect(call('give_card', { card: loose.identifier, to: 'プレイヤー' })).rejects.toBeInstanceOf(
      AgentToolError
    );
    expect(loose.location.name).toBe('table');
  });

  it("refuses to draw from another's hand where the room forbids it", async () => {
    peer('pl', 'プレイヤー');
    card('引かれる').toHand('pl');
    Config.instance.allowsHandDraw = false;

    await expect(call('take_card', { from: 'プレイヤー' })).rejects.toBeInstanceOf(AgentToolError);
  });

  it('plays a card from its hand face up at a square, and turns it over', async () => {
    const played = card('出す');
    played.toHand('me');

    const result = await call('play_card', { card: played.identifier, col: 3, row: 2 });

    expect(played.location.name).toBe('table');
    expect(played.state).toBe(CardState.FRONT);
    expect(result['square']).toEqual({ col: 3, row: 2 });

    await call('flip_card', { card: played.identifier, face: 'down' });
    expect(played.state).toBe(CardState.BACK);
  });

  it('refuses to play a card from a hand it does not hold for', async () => {
    peer('pl', 'プレイヤー');
    const theirs = card('他人の');
    theirs.toHand('pl');

    await expect(call('play_card', { card: theirs.identifier })).rejects.toBeInstanceOf(AgentToolError);
    expect(theirs.location.name).toBe(handLocationOf('pl'));
  });

  it('deals a deck out to the hands named', async () => {
    peer('pl', 'プレイヤー');
    deckOf('A', 'B', 'C', 'D');

    const result = await call('deal_cards', { deck: '山札', to: ['AI', 'プレイヤー'] });

    expect(result['dealt']).toBe(4);
    expect(result['hands']).toBe(2);
  });

  it('says a deck it cannot find is not there', async () => {
    await expect(call('shuffle_deck', { deck: '無い山' })).rejects.toMatchObject({ code: 'not_found' });
  });
});
