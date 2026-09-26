import { TestBed } from '@angular/core/testing';
import { CardGameService } from '@axe/application/card/card-game.service';
import { ChatMessageService } from '@axe/application/chat/chat-message.service';
import { IPeerContext } from '@axe/core/network/peer-context';
import { resetPeerContextProvider, setPeerContextProvider } from '@axe/core/network/peer-context-source';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Card, CardState } from '@axe/domain/card/card';
import { CardStack } from '@axe/domain/card/card-stack';
import { handLocationOf } from '@axe/domain/card/hand-location';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { Config } from '@axe/domain/peer/config';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('CardGameService', () => {
  let service: CardGameService;
  let sendSystemMessage: ReturnType<typeof vi.fn>;
  const created: { destroy(): void }[] = [];

  function trumpCard(code: string): Card {
    const card = Card.create('カード', `./assets/images/trump/${code}.webp`, './assets/images/trump/z01.webp');
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

  beforeEach(() => {
    // Whoever ran before may have left a cursor behind, and a stray one counts as
    // another player at the table.
    for (const cursor of ObjectStore.instance.getObjects<PeerCursor>(PeerCursor)) {
      ObjectStore.instance.delete(cursor, false);
    }
    ObjectStore.instance.clearDeleteHistory();
    PeerCursor.myCursor = null!;
    PeerCursor.createMyCursor();
    PeerCursor.myCursor.userId = 'me';
    PeerCursor.myCursor.name = 'わたし';
    PeerCursor.myCursor.role = PeerRole.Player;
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    service = TestBed.inject(CardGameService);
    sendSystemMessage = vi
      .spyOn(TestBed.inject(ChatMessageService), 'sendSystemMessage')
      .mockReturnValue(null as unknown as ChatMessage) as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    Config.instance.allowsHandDraw = true;
    Config.instance.allowsHandGive = true;
    Config.instance.handVisibilityMode = 'choice';
    Config.instance.allowPlayerCardEdit = false;
    vi.restoreAllMocks();
    for (const object of created.splice(0)) object.destroy();
    for (const cursor of ObjectStore.instance.getObjects<PeerCursor>(PeerCursor)) {
      if (cursor !== PeerCursor.myCursor) ObjectStore.instance.delete(cursor, false);
    }
  });

  describe('dealAll()', () => {
    it('deals out to everyone and hands out exactly one joker', () => {
      const other = peer('other', 'あいて');
      const stack = CardStack.create('山札');
      created.push(stack);
      for (const code of ['s01', 's02', 'h01', 'h02', 'x01', 'x02']) stack.putOnBottom(trumpCard(code));

      const result = service.dealAll(stack);

      expect(result).toEqual({ dealt: 5, participants: 2 });
      expect(service.handCardsOf('me').length + service.handCardsOf(other.userId).length).toBe(5);
      expect(stack.cards).toHaveLength(1);
      expect(sendSystemMessage).toHaveBeenCalledOnce();
    });

    it('gives no two cards in a hand the same place', () => {
      const stack = CardStack.create('山札');
      created.push(stack);
      for (const code of ['s01', 's02', 's03']) stack.putOnBottom(trumpCard(code));

      service.dealAll(stack);

      const orders = service.handCardsOf('me').map((card) => card.handOrder);
      expect(new Set(orders).size).toBe(orders.length);
    });

    it('deals nothing to an onlooker', () => {
      peer('guest', 'けんがく', PeerRole.Guest);
      const stack = CardStack.create('山札');
      created.push(stack);
      for (const code of ['s01', 's02']) stack.putOnBottom(trumpCard(code));

      const result = service.dealAll(stack);

      expect(result.participants).toBe(1);
      expect(service.handCardsOf('guest')).toHaveLength(0);
    });
  });

  it('uses the room visibility rule ahead of each participant choice', () => {
    const other = peer('other', 'あいて');
    other.handPublic = true;
    expect(service.handPublicOf('other')).toBe(true);

    Config.instance.handVisibilityMode = 'private';
    expect(service.handPublicOf('other')).toBe(false);

    other.handPublic = false;
    Config.instance.handVisibilityMode = 'public';
    expect(service.handPublicOf('other')).toBe(true);
  });

  it('lets the GM edit cards but requires a room opt-in for players', () => {
    expect(service.canEditCards()).toBe(false);
    Config.instance.allowPlayerCardEdit = true;
    expect(service.canEditCards()).toBe(true);
    PeerCursor.myCursor.role = PeerRole.GameMaster;
    Config.instance.allowPlayerCardEdit = false;
    expect(service.canEditCards()).toBe(true);
    PeerCursor.myCursor.role = PeerRole.Guest;
    expect(service.canEditCards()).toBe(false);
  });

  describe('canEditCard()', () => {
    beforeEach(() => {
      setPeerContextProvider({
        peerContext: { userId: 'me', peerId: 'me/peer' } as IPeerContext,
        peerContexts: [],
        peerIds: [],
        peerId: 'me/peer',
      });
    });
    afterEach(() => resetPeerContextProvider());

    it('lets a permitted player edit only cards whose front they can already see', () => {
      Config.instance.allowPlayerCardEdit = true;
      const faceUp = trumpCard('s01');
      faceUp.faceUp();
      const faceDown = trumpCard('s02');
      faceDown.faceDown();
      const inMyHand = trumpCard('s03');
      inMyHand.toHand('me');
      const inOtherHand = trumpCard('s04');
      inOtherHand.toHand('other');
      const peekedByOther = trumpCard('s05');
      peekedByOther.faceDown();
      peekedByOther.owner = 'other';

      expect(service.canEditCard(faceUp)).toBe(true);
      expect(service.canEditCard(inMyHand)).toBe(true);
      expect(service.canEditCard(faceDown)).toBe(false);
      expect(service.canEditCard(inOtherHand)).toBe(false);
      expect(service.canEditCard(peekedByOther)).toBe(false);
    });

    it('lets nobody but the GM edit while the room keeps its default', () => {
      const inMyHand = trumpCard('s03');
      inMyHand.toHand('me');
      const faceDown = trumpCard('s02');
      faceDown.faceDown();

      expect(service.canEditCard(inMyHand)).toBe(false);
      PeerCursor.myCursor.role = PeerRole.GameMaster;
      expect(service.canEditCard(inMyHand)).toBe(true);
      expect(service.canEditCard(faceDown)).toBe(true);
    });
  });

  describe('giveRecipients()', () => {
    it('lists every card holder except yourself and onlookers', () => {
      peer('other', 'あいて');
      peer('guest', 'けんがく', PeerRole.Guest);

      expect(service.giveRecipients()).toEqual([{ userId: 'other', name: 'あいて' }]);
    });
  });

  describe('giveFromTable()', () => {
    it('sends a face-up table card to another hand face down and announces it without naming the card', () => {
      peer('other', 'あいて');
      const card = trumpCard('s07');
      card.faceUp();

      expect(service.giveFromTable(card, 'other')).toBe(true);

      expect(card.location.name).toBe(handLocationOf('other'));
      expect(card.state).toBe(CardState.BACK);
      expect(card.owner).toBe('');
      expect(card.lastHandGiverUserId).toBe('me');
      expect(sendSystemMessage).toHaveBeenCalledOnce();
      expect(sendSystemMessage.mock.calls[0][0]).toBe('わたし が あいて にカードを 1 枚渡しました');
    });

    it('drops a peek on the card as it leaves the table', () => {
      peer('other', 'あいて');
      const card = trumpCard('s07');
      card.faceDown();
      card.owner = 'me';

      expect(service.giveFromTable(card, 'other')).toBe(true);
      expect(card.owner).toBe('');
      expect(card.state).toBe(CardState.BACK);
    });

    it('refuses cards in a hand or a stack, yourself, guests and rooms that forbid giving', () => {
      peer('other', 'あいて');
      peer('guest', 'けんがく', PeerRole.Guest);
      const inHand = trumpCard('s01');
      inHand.toHand('third');
      const stack = CardStack.create('山札');
      created.push(stack);
      const inStack = trumpCard('s02');
      stack.putOnTop(inStack);
      const loose = trumpCard('s03');

      expect(service.giveFromTable(inHand, 'other')).toBe(false);
      expect(service.giveFromTable(inStack, 'other')).toBe(false);
      expect(service.giveFromTable(loose, 'me')).toBe(false);
      expect(service.giveFromTable(loose, 'guest')).toBe(false);
      expect(service.giveFromTable(loose, 'nobody')).toBe(false);
      Config.instance.allowsHandGive = false;
      expect(service.giveFromTable(loose, 'other')).toBe(false);

      expect(inHand.location.name).toBe(handLocationOf('third'));
      expect(stack.cards).toEqual([inStack]);
      expect(loose.location.name).toBe('table');
      expect(sendSystemMessage).not.toHaveBeenCalled();
    });

    it('refuses to give for an onlooker', () => {
      peer('other', 'あいて');
      const card = trumpCard('s07');
      PeerCursor.myCursor.role = PeerRole.Guest;

      expect(service.canGiveCards()).toBe(false);
      expect(service.giveFromTable(card, 'other')).toBe(false);
      expect(card.location.name).toBe('table');
    });
  });

  describe('giveFromStackTop()', () => {
    it('sends only the top card, face down, even when the stack shows it face up', () => {
      peer('other', 'あいて');
      const stack = CardStack.create('山札');
      created.push(stack);
      const top = trumpCard('s01');
      const below = trumpCard('s02');
      stack.putOnBottom(top);
      stack.putOnBottom(below);
      stack.faceUp();

      expect(service.giveFromStackTop(stack, 'other')).toBe(true);

      expect(top.location.name).toBe(handLocationOf('other'));
      expect(top.state).toBe(CardState.BACK);
      expect(top.owner).toBe('');
      expect(top.lastHandGiverUserId).toBe('me');
      expect(stack.cards).toEqual([below]);
      expect(sendSystemMessage).toHaveBeenCalledOnce();
    });

    it('leaves the stack untouched for an empty stack, a refused recipient or a forbidding room', () => {
      peer('other', 'あいて');
      const empty = CardStack.create('空');
      created.push(empty);
      const stack = CardStack.create('山札');
      created.push(stack);
      const top = trumpCard('s01');
      stack.putOnTop(top);

      expect(service.giveFromStackTop(empty, 'other')).toBe(false);
      expect(service.giveFromStackTop(stack, 'me')).toBe(false);
      Config.instance.allowsHandGive = false;
      expect(service.giveFromStackTop(stack, 'other')).toBe(false);

      expect(stack.cards).toEqual([top]);
      expect(top.location.name).not.toBe(handLocationOf('other'));
      expect(sendSystemMessage).not.toHaveBeenCalled();
    });
  });

  describe('drawFromHand()', () => {
    it('moves a card from another hand into your own', () => {
      peer('other', 'あいて');
      const card = trumpCard('s07');
      card.toHand('other');

      expect(service.drawFromHand(card, 'あいて')).toBe(true);

      expect(card.location.name).toBe(handLocationOf('me'));
      expect(service.handCardsOf('other')).toHaveLength(0);
      expect(sendSystemMessage).toHaveBeenCalledOnce();
    });

    it('does not take a card that lies on the table or is already yours', () => {
      const onTable = trumpCard('s07');
      const mine = trumpCard('s08');
      mine.toHand('me');

      expect(service.drawFromHand(onTable, 'あいて')).toBe(false);
      expect(service.drawFromHand(mine, 'わたし')).toBe(false);
      expect(onTable.location.name).toBe('table');
      expect(sendSystemMessage).not.toHaveBeenCalled();
    });

    it('does not take a card while the room forbids drawing from hands', () => {
      const card = trumpCard('s07');
      card.toHand('other');
      Config.instance.allowsHandDraw = false;

      expect(service.allowsHandDraw()).toBe(false);
      expect(service.drawFromHand(card, 'あいて')).toBe(false);
      expect(card.location.name).toBe(handLocationOf('other'));
      expect(sendSystemMessage).not.toHaveBeenCalled();
    });

    it('does not let a player take a card from the hand of someone no longer in the room', () => {
      const card = trumpCard('s07');
      card.toHand('gone');

      expect(service.drawFromHand(card, '')).toBe(false);
      expect(card.location.name).toBe(handLocationOf('gone'));
      expect(sendSystemMessage).not.toHaveBeenCalled();
    });
  });

  describe('orphaned hands', () => {
    function secretCard(name: string, userId: string, handOrder: number): Card {
      const card = Card.create(name, './assets/images/trump/s01.webp', './assets/images/trump/z01.webp');
      created.push(card);
      card.toHand(userId, handOrder);
      return card;
    }

    function identifiersOf(cards: Card[]): string[] {
      return cards.map((card) => card.identifier);
    }

    beforeEach(() => {
      PeerCursor.myCursor.role = PeerRole.GameMaster;
      PeerCursor.myCursor.peerId = 'peer-me';
      setPeerContextProvider({
        peerContext: { userId: 'me', peerId: 'peer-me' } as IPeerContext,
        peerContexts: [],
        peerIds: ['peer-other'],
        peerId: 'peer-me',
      });
    });
    afterEach(() => resetPeerContextProvider());

    it('lists only hands whose holder has no cursor, in hand order, for several absent users', () => {
      peer('other', 'あいて');
      peer('dropping', 'きれかけ');
      const second = secretCard('ひみつB', 'gone-1', 20);
      const first = secretCard('ひみつA', 'gone-1', 10);
      const lone = secretCard('ひみつC', 'gone-2', 5);
      secretCard('ひみつD', 'other', 1);
      secretCard('ひみつE', 'dropping', 1);
      secretCard('ひみつF', 'me', 1);

      const hands = service.orphanHands();

      expect(hands.map((hand) => hand.userId)).toEqual(['gone-1', 'gone-2']);
      expect(hands[0].cards).toEqual([first, second]);
      expect(hands[1].cards).toEqual([lone]);
    });

    it('offers only connected participants who may hold cards, yourself included', () => {
      peer('other', 'あいて');
      peer('dropping', 'きれかけ');
      peer('guest', 'けんがく', PeerRole.Guest);

      expect(service.orphanHandRecipients().map((seat) => seat.userId)).toEqual(['me', 'other']);
    });

    it('moves the whole hand face down, in order, after the cards the recipient already holds', () => {
      peer('other', 'あいて');
      const held = secretCard('もちふだ', 'other', Date.now() + 1_000_000);
      const second = secretCard('ひみつB', 'gone', 20);
      const first = secretCard('ひみつA', 'gone', 10);
      // Whatever state a saved room left them in, they arrive hidden from all but the recipient.
      first.state = CardState.FRONT;
      second.owner = 'someone';

      const result = service.rescueOrphanHand('gone', 'other', identifiersOf([first, second]));

      expect(result).toBe('moved');
      expect(service.handCardsOf('other')).toEqual([held, first, second]);
      expect(service.orphanHands()).toEqual([]);
      for (const card of [first, second]) {
        expect(card.state).toBe(CardState.BACK);
        expect(card.owner).toBe('');
        expect(card.lastHandGiverUserId).toBe('');
      }
      expect(sendSystemMessage).toHaveBeenCalledOnce();
      const message = sendSystemMessage.mock.calls[0][0] as string;
      expect(message).toContain('あいて');
      expect(message).toContain('2');
      expect(message).not.toContain('ひみつ');
    });

    it('ignores the room give and draw rules, which are for players', () => {
      peer('other', 'あいて');
      const card = secretCard('ひみつA', 'gone', 1);
      Config.instance.allowsHandGive = false;
      Config.instance.allowsHandDraw = false;

      expect(service.rescueOrphanHand('gone', 'other', [card.identifier])).toBe('moved');
      expect(card.location.name).toBe(handLocationOf('other'));
    });

    it('lets the game master take the hand into their own', () => {
      const card = secretCard('ひみつA', 'gone', 1);

      expect(service.rescueOrphanHand('gone', 'me', [card.identifier])).toBe('moved');
      expect(card.location.name).toBe(handLocationOf('me'));
    });

    it('refuses a player or a guest, moving nothing', () => {
      peer('other', 'あいて');
      const card = secretCard('ひみつA', 'gone', 1);

      for (const role of [PeerRole.Player, PeerRole.Guest]) {
        PeerCursor.myCursor.role = role;
        expect(service.canRescueOrphanHands()).toBe(false);
        expect(service.rescueOrphanHand('gone', 'me', [card.identifier])).toBe('notGameMaster');
        expect(service.rescueOrphanHand('gone', 'other', [card.identifier])).toBe('notGameMaster');
      }
      expect(card.location.name).toBe(handLocationOf('gone'));
      expect(sendSystemMessage).not.toHaveBeenCalled();
    });

    it('refuses once the holder is back in the room', () => {
      peer('other', 'あいて');
      const card = secretCard('ひみつA', 'gone', 1);
      peer('gone', 'もどった');

      expect(service.rescueOrphanHand('gone', 'other', [card.identifier])).toBe('sourcePresent');
      expect(card.location.name).toBe(handLocationOf('gone'));
    });

    it('refuses a recipient who is not connected, is a guest, or is unknown', () => {
      peer('dropping', 'きれかけ');
      peer('guest', 'けんがく', PeerRole.Guest);
      const card = secretCard('ひみつA', 'gone', 1);

      for (const userId of ['dropping', 'guest', 'nobody', 'gone']) {
        expect(service.rescueOrphanHand('gone', userId, [card.identifier])).toBe('recipientUnavailable');
      }
      expect(card.location.name).toBe(handLocationOf('gone'));
      expect(sendSystemMessage).not.toHaveBeenCalled();
    });

    it('refuses when the hand is no longer what was confirmed', () => {
      peer('other', 'あいて');
      const first = secretCard('ひみつA', 'gone', 1);
      const second = secretCard('ひみつB', 'gone', 2);
      const confirmed = identifiersOf([first, second]);

      const added = secretCard('ひみつC', 'gone', 3);
      expect(service.rescueOrphanHand('gone', 'other', confirmed)).toBe('handChanged');
      added.setLocation('table');

      second.setLocation('table');
      expect(service.rescueOrphanHand('gone', 'other', confirmed)).toBe('handChanged');

      first.setLocation('table');
      expect(service.rescueOrphanHand('gone', 'other', [])).toBe('handChanged');
      expect(sendSystemMessage).not.toHaveBeenCalled();
      expect(service.handCardsOf('other')).toEqual([]);
    });

    it('survives a save and reload, carrying no new attribute', () => {
      peer('other', 'あいて');
      const card = secretCard('ひみつA', 'gone', 1);
      // happy-dom's XML parser rejects dotted attribute names such as location.name, so the saved
      // attributes are read off the tag and replayed the way ObjectSerializer.parseXml applies them.
      const attributesOf = (xml: string) =>
        Array.from(/^<\w+([^>]*)>/.exec(xml)![1].matchAll(/([\w.]+)="([^"]*)"/g), ([, name, value]) => ({
          name,
          value,
        }));
      const reload = (xml: string): Card => {
        const restored = new Card();
        restored.parseAttributes(attributesOf(xml) as unknown as NamedNodeMap);
        return restored;
      };
      const namesOf = (xml: string) => attributesOf(xml).map((attribute) => attribute.name);
      const before = namesOf(card.toXml());

      expect(reload(card.toXml()).location.name).toBe(handLocationOf('gone'));

      service.rescueOrphanHand('gone', 'other', [card.identifier]);
      const saved = card.toXml();
      expect(namesOf(saved)).toEqual(before);

      const reloaded = reload(saved);
      expect(reloaded.location.name).toBe(handLocationOf('other'));
      expect(reloaded.handOrder).toBe(card.handOrder);
      expect(reloaded.state).toBe(CardState.BACK);
    });
  });

  describe('giveFromHand()', () => {
    it('moves one of your cards to another participant without revealing its face', () => {
      peer('other', 'あいて');
      const card = trumpCard('s07');
      card.toHand('me');

      expect(service.giveFromHand(card, 'other')).toBe(true);

      expect(card.location.name).toBe(handLocationOf('other'));
      expect(card.state).toBe(CardState.BACK);
      expect(card.lastHandGiverUserId).toBe('me');
      expect(card.lastHandGiverName).toBe('わたし');
      expect(service.handCardsOf('me')).toHaveLength(0);
      expect(sendSystemMessage).toHaveBeenCalledOnce();
    });

    it("does not move somebody else's card or give a card to a guest", () => {
      peer('guest', 'けんがく', PeerRole.Guest);
      const card = trumpCard('s07');
      card.toHand('other');

      expect(service.giveFromHand(card, 'guest')).toBe(false);
      card.toHand('me');
      expect(service.giveFromHand(card, 'guest')).toBe(false);
      expect(card.location.name).toBe(handLocationOf('me'));
      expect(sendSystemMessage).not.toHaveBeenCalled();
    });

    it('does not give a card after its holder becomes a guest', () => {
      peer('other', 'あいて');
      const card = trumpCard('s07');
      card.toHand('me');
      PeerCursor.myCursor.role = PeerRole.Guest;

      expect(service.giveFromHand(card, 'other')).toBe(false);
      expect(card.location.name).toBe(handLocationOf('me'));
    });

    it('does not give a card while the room forbids giving, though drawing stays allowed', () => {
      peer('other', 'あいて');
      const card = trumpCard('s07');
      card.toHand('me');
      Config.instance.allowsHandGive = false;

      expect(service.allowsHandGive()).toBe(false);
      expect(service.allowsHandDraw()).toBe(true);
      expect(service.giveFromHand(card, 'other')).toBe(false);
      expect(card.location.name).toBe(handLocationOf('me'));
      expect(card.lastHandGiverUserId).toBe('');
      expect(sendSystemMessage).not.toHaveBeenCalled();
    });

    it('replaces the previous giver when the card is passed on', () => {
      peer('other', 'あいて');
      peer('third', '第三者');
      const card = trumpCard('s07');
      card.toHand('me');
      service.giveFromHand(card, 'other');
      PeerCursor.myCursor.userId = 'other';
      PeerCursor.myCursor.name = 'あいて';

      expect(service.giveFromHand(card, 'third')).toBe(true);
      expect(card.lastHandGiverUserId).toBe('other');
      expect(card.lastHandGiverName).toBe('あいて');
    });
  });

  describe('discardPairs()', () => {
    it('lays a matching pair face up on the discard pile', () => {
      const spade = trumpCard('s07');
      const heart = trumpCard('h07');
      const odd = trumpCard('c03');
      for (const card of [spade, heart, odd]) card.toHand('me');
      spade.lastHandGiverUserId = 'giver';
      spade.lastHandGiverName = 'Giver';

      const pairs = service.discardPairs(service.handCardsOf('me'));

      expect(pairs).toHaveLength(1);
      const discard = ObjectStore.instance.getObjects<CardStack>(CardStack).find((stack) => stack.name === '捨て札');
      expect(discard?.cards).toHaveLength(2);
      expect(spade.isFront).toBe(true);
      expect(spade.lastHandGiverUserId).toBe('');
      expect(spade.lastHandGiverName).toBe('');
      expect(service.handCardsOf('me')).toEqual([odd]);
      if (discard) created.push(discard);
    });

    it('does nothing without a pair', () => {
      const card = trumpCard('s07');
      card.toHand('me');

      expect(service.discardPairs(service.handCardsOf('me'))).toEqual([]);
      expect(sendSystemMessage).not.toHaveBeenCalled();
    });
  });
});
