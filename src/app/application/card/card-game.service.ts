import { inject, Injectable } from '@angular/core';
import { ChatMessageService } from '@axe/application/chat/chat-message.service';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { getPeerContext, getPeerIds } from '@axe/core/network/peer-context-source';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Card } from '@axe/domain/card/card';
import { planDeal } from '@axe/domain/card/card-deal';
import { CardStack } from '@axe/domain/card/card-stack';
import { selectHandCardsOf } from '@axe/domain/card/hand-cards';
import { handHolderOf } from '@axe/domain/card/hand-location';
import { appendHandOrderAfter, OrphanHand, selectOrphanHands, shortUserIdOf } from '@axe/domain/card/orphan-hands';
import { findTrumpPairs, selectExtraJokers, trumpRankOf } from '@axe/domain/card/trump-card';
import { PresetSound, SoundEffect } from '@axe/domain/media/sound-effect';
import { Config } from '@axe/domain/peer/config';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { canRoleEdit, canRoleSeeHidden, PeerRole } from '@axe/domain/peer/peer-role';

const DISCARD_STACK_OFFSET = 150;

export interface CardSeat {
  userId: string;
  name: string;
}

/** How a game master's attempt to hand over an orphaned hand ended; anything but `moved` left every card where it was. */
export type OrphanHandRescueResult =
  'moved' | 'notGameMaster' | 'sourcePresent' | 'recipientUnavailable' | 'handChanged';

export interface DealResult {
  dealt: number;
  participants: number;
}

@Injectable({ providedIn: 'root' })
export class CardGameService {
  private readonly objectStore = inject(ObjectStore);
  private readonly chatMessageService = inject(ChatMessageService);
  private readonly t = inject(TRANSLATE_FN);

  /** Your own user id. Outside a room it is not on the cursor yet, so the peer context answers instead. */
  myUserId(): string {
    const fromCursor = PeerCursor.myCursor?.userId ?? '';
    return fromCursor.length > 0 ? fromCursor : getPeerContext().userId;
  }

  /** Who can hold cards, judged the same way the hand rail judges it. */
  participants(): CardSeat[] {
    const seats = this.objectStore
      .getObjects<PeerCursor>(PeerCursor)
      .filter((cursor) => cursor.userId.length > 0 && canRoleEdit(cursor.role))
      .map((cursor) => ({ userId: cursor.userId, name: cursor.name }));

    const myUserId = this.myUserId();
    if (myUserId.length > 0 && canRoleEdit(PeerCursor.myRole) && !seats.some((seat) => seat.userId === myUserId)) {
      seats.unshift({ userId: myUserId, name: PeerCursor.myCursor?.name ?? '' });
    }
    return seats;
  }

  /** The cards in a user's hand, in the order they were taken into it. */
  handCardsOf(userId: string): Card[] {
    return selectHandCardsOf(this.objectStore.getObjects<Card>(Card), userId);
  }

  /**
   * Shuffles a stack and deals all of it evenly into every participant's hand, announcing the deal
   * in chat.
   *
   * Jokers beyond `keepJokerCount` are put back on the bottom of the stack rather than dealt. With
   * nobody to deal to, a system message says so and nothing moves.
   */
  dealAll(cardStack: CardStack, keepJokerCount = 1): DealResult {
    const seats = this.participants();
    if (seats.length < 1) {
      this.chatMessageService.sendSystemMessage(this.t('feature.cardStack.message.noSeats'));
      return { dealt: 0, participants: 0 };
    }

    cardStack.shuffle();
    const excluded = new Set(selectExtraJokers(cardStack.cards, keepJokerCount).map((card) => card.identifier));
    const drawn = cardStack.drawCardAll();
    const cards = drawn.filter((card) => !excluded.has(card.identifier));
    for (const card of drawn.filter((card) => excluded.has(card.identifier))) cardStack.putOnBottom(card);
    if (cards.length < 1) return { dealt: 0, participants: seats.length };

    const plan = planDeal(cards.length, seats.length);
    const baseOrder = Date.now();
    seats.forEach((seat, seatIndex) => {
      plan.indexes[seatIndex].forEach((cardIndex, order) => {
        cards[cardIndex].toHand(seat.userId, baseOrder + order);
      });
    });

    SoundEffect.play(PresetSound.cardDraw);
    this.chatMessageService.sendSystemMessage(
      this.t('feature.cardStack.message.dealt', { count: cards.length, players: seats.length })
    );
    return { dealt: cards.length, participants: seats.length };
  }

  /** Whether the room lets a participant take a card from someone else's hand. A room with no config yet allows it. */
  allowsHandDraw(): boolean {
    return this.objectStore.get<Config>('Config')?.allowsHandDraw ?? true;
  }

  /** Whether the room lets a participant give a card from their hand to someone else. A room with no config yet allows it. */
  allowsHandGive(): boolean {
    return this.objectStore.get<Config>('Config')?.allowsHandGive ?? true;
  }

  /** Room rules override a participant's own public-hand choice without changing their cursor. */
  handPublicOf(userId: string): boolean {
    const mode = this.objectStore.get<Config>('Config')?.handVisibilityMode ?? 'choice';
    if (mode !== 'choice') return mode === 'public';
    return PeerCursor.findByUserId(userId)?.handPublic ?? false;
  }

  /** Card property edits are GM-only until the room explicitly permits players. Guests never edit. */
  canEditCards(): boolean {
    if (PeerCursor.myRole === PeerRole.GameMaster) return true;
    return (
      PeerCursor.myRole === PeerRole.Player && (this.objectStore.get<Config>('Config')?.allowPlayerCardEdit ?? false)
    );
  }

  /**
   * Whether this user may open the editor of this particular card.
   *
   * Besides the room permission, a player must be able to see the card's front, so the editor never
   * shows the face of a card lying face down, sitting in another hand, or peeked at by someone else.
   */
  canEditCard(card: Card): boolean {
    if (!this.canEditCards()) return false;
    if (canRoleSeeHidden(PeerCursor.myRole)) return true;
    return !(card.hasOwner && !card.isMine) && card.isVisible;
  }

  /** Whether this user may send cards to other hands at all: they can hold cards and the room allows giving. */
  canGiveCards(): boolean {
    return this.myUserId().length > 0 && canRoleEdit(PeerCursor.myRole) && this.allowsHandGive();
  }

  /** The participants a card can be given to, which is everyone who holds cards except yourself. */
  giveRecipients(): CardSeat[] {
    const myUserId = this.myUserId();
    return this.participants().filter((seat) => seat.userId !== myUserId);
  }

  /**
   * Takes a card from someone else's hand into your own and says so in chat.
   *
   * False, with nothing moved, while you have no user id or may not hold cards, when the card is in
   * no other hand, when the room forbids drawing from hands, or when the holder is no longer in the
   * room: an orphaned hand is only for the game master to hand over.
   */
  drawFromHand(card: Card, fromName: string): boolean {
    const myUserId = this.myUserId();
    if (myUserId.length < 1 || !canRoleEdit(PeerCursor.myRole) || !this.allowsHandDraw()) return false;
    const holder = handHolderOf(card.location.name);
    if (!holder || holder === myUserId || !PeerCursor.findByUserId(holder)) return false;

    card.toHand(myUserId);
    SoundEffect.play(PresetSound.cardDraw);
    this.chatMessageService.sendSystemMessage(
      this.t('feature.card.message.drewFromHand', { from: fromName, to: PeerCursor.myCursor?.name ?? '' })
    );
    return true;
  }

  /** Gives one of your hand cards to another participant, keeping it hidden in their hand. False while the room forbids it. */
  giveFromHand(card: Card, recipientUserId: string): boolean {
    const recipient = this.recipientForGive(recipientUserId);
    if (!recipient || !this.handCardsOf(this.myUserId()).includes(card)) return false;

    this.finishGiving(card, recipient, true);
    return true;
  }

  /**
   * Sends one loose card from the table to another participant's hand, face down so only they see it.
   *
   * False, with nothing moved, for a card already in a hand or inside a stack, or whenever
   * {@link giveFromHand} would refuse the recipient.
   */
  giveFromTable(card: Card, recipientUserId: string): boolean {
    if (card.isInAnyHand || card.parent?.parent instanceof CardStack) return false;
    const recipient = this.recipientForGive(recipientUserId);
    if (!recipient) return false;
    this.finishGiving(card, recipient, false);
    return true;
  }

  /**
   * Takes the top card off a stack and sends it straight to another participant's hand, face down,
   * so its front is never shown to the giver or the table.
   *
   * False, with the stack untouched, when it is empty or the recipient is refused.
   */
  giveFromStackTop(stack: CardStack, recipientUserId: string): boolean {
    if (!stack.topCard) return false;
    const recipient = this.recipientForGive(recipientUserId);
    if (!recipient) return false;
    const card = stack.drawCard();
    if (!card) return false;
    stack.update();
    this.finishGiving(card, recipient, false);
    return true;
  }

  /**
   * The hands left behind by participants no longer in the room, as saved rooms can bring back.
   *
   * Only a user with no cursor at all counts as absent; one who has just dropped keeps their cursor
   * for a while and may still come back to their hand.
   */
  orphanHands(): OrphanHand[] {
    return selectOrphanHands(this.objectStore.getObjects<Card>(Card), this.presentUserIds());
  }

  /** Whether you may hand an orphaned hand over to someone: only the game master may. */
  canRescueOrphanHands(): boolean {
    return PeerCursor.myRole === PeerRole.GameMaster && this.myUserId().length > 0;
  }

  /** Who may take over an orphaned hand: participants who can hold cards and are connected right now, yourself included. */
  orphanHandRecipients(): CardSeat[] {
    const myUserId = this.myUserId();
    const connected = new Set(getPeerIds());
    return this.participants().filter((seat) => {
      if (seat.userId === myUserId) return true;
      const peerId = PeerCursor.findByUserId(seat.userId)?.peerId ?? '';
      return peerId.length > 0 && connected.has(peerId);
    });
  }

  /**
   * Moves every card of an absent participant's hand into a connected participant's hand, face down
   * and in the same order after the cards they already hold, and says so in chat without naming any
   * card.
   *
   * Everything is checked again at the moment of moving, and nothing moves unless you are still the
   * game master, the holder is still absent, the recipient may still take it, and the hand still
   * holds exactly the cards that were confirmed. The room's give and draw rules do not apply: this is
   * the game master recovering cards nobody could otherwise reach.
   */
  rescueOrphanHand(
    fromUserId: string,
    toUserId: string,
    confirmedCardIdentifiers: readonly string[]
  ): OrphanHandRescueResult {
    if (!this.canRescueOrphanHands()) return 'notGameMaster';
    if (this.presentUserIds().has(fromUserId)) return 'sourcePresent';
    const recipient = this.orphanHandRecipients().find((seat) => seat.userId === toUserId);
    if (!recipient) return 'recipientUnavailable';

    const cards = this.handCardsOf(fromUserId);
    const confirmed = new Set(confirmedCardIdentifiers);
    if (cards.length < 1 || cards.length !== confirmed.size || cards.some((card) => !confirmed.has(card.identifier))) {
      return 'handChanged';
    }

    const baseOrder = appendHandOrderAfter(this.handCardsOf(recipient.userId), Date.now());
    cards.forEach((card, index) => card.toHand(recipient.userId, baseOrder + index));

    SoundEffect.play(PresetSound.cardDraw);
    this.chatMessageService.sendSystemMessage(
      this.t('feature.card.message.rescuedOrphanHand', {
        gm: PeerCursor.myCursor?.name ?? '',
        from: shortUserIdOf(fromUserId),
        count: cards.length,
        to: recipient.name,
      })
    );
    return 'moved';
  }

  private presentUserIds(): Set<string> {
    const present = new Set(this.objectStore.getObjects<PeerCursor>(PeerCursor).map((cursor) => cursor.userId));
    const myUserId = this.myUserId();
    if (myUserId.length > 0) present.add(myUserId);
    return present;
  }

  private recipientForGive(userId: string): CardSeat | null {
    if (!this.canGiveCards()) return null;
    return this.giveRecipients().find((seat) => seat.userId === userId) ?? null;
  }

  private finishGiving(card: Card, recipient: CardSeat, fromHand: boolean): void {
    card.toHand(recipient.userId);
    card.lastHandGiverUserId = this.myUserId();
    card.lastHandGiverName = PeerCursor.myCursor?.name ?? '';
    SoundEffect.play(PresetSound.cardDraw);
    this.chatMessageService.sendSystemMessage(
      this.t(fromHand ? 'feature.card.message.gaveFromHand' : 'feature.card.message.gaveCard', {
        from: PeerCursor.myCursor?.name ?? '',
        to: recipient.name,
      })
    );
  }

  /**
   * Discards every pair of the same rank among the cards, face up, onto the discard stack on the
   * table, and announces it.
   *
   * The discard stack is created if the table has none. Returns the pairs discarded, empty when
   * there were none.
   */
  discardPairs(cards: readonly Card[]): Card[][] {
    const pairs = findTrumpPairs(cards);
    if (pairs.length < 1) return [];

    const stack = this.findOrCreateDiscardStack();
    for (const pair of pairs) {
      for (const card of pair) {
        card.faceUp();
        stack.putOnTop(card);
      }
    }

    SoundEffect.play(PresetSound.cardPut);
    this.chatMessageService.sendSystemMessage(
      this.t('feature.card.message.discardedPairs', {
        name: PeerCursor.myCursor?.name ?? '',
        ranks: pairs.map((pair) => this.rankLabel(pair[0])).join('・'),
      })
    );
    return pairs;
  }

  private rankLabel(card: Card): string {
    const rank = trumpRankOf(card);
    return typeof rank === 'number' ? String(rank) : '?';
  }

  private findOrCreateDiscardStack(): CardStack {
    const name = this.t('feature.card.discardStackName');
    const existing = this.objectStore
      .getObjects<CardStack>(CardStack)
      .find((stack) => stack.name === name && stack.location.name === 'table');
    if (existing) return existing;

    const stack = CardStack.create(name);
    stack.location.name = 'table';
    stack.location.x = DISCARD_STACK_OFFSET;
    stack.location.y = DISCARD_STACK_OFFSET;
    stack.toTopmost();
    return stack;
  }
}
