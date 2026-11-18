import { inject, Injectable } from '@angular/core';
import type { AgentHandler } from '@axe/application/agent/agent-tool-runner.service';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { TabletopService } from '@axe/application/tabletop/tabletop.service';
import { AgentToolError } from '@axe/core/agent/agent-error';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Card } from '@axe/domain/card/card';
import { CardStack } from '@axe/domain/card/card-stack';
import { handLocationOf, isHandLocation } from '@axe/domain/card/hand-location';
import { PresetSound, SoundEffect } from '@axe/domain/media/sound-effect';
import { findOne, numberArg, textArg } from '@axe/features/agent-tools/agent-lookup';
import { CardGameService, CardSeat } from '@axe/features/card/card-game.service';

/** A card as this seat is shown it: its face only where the seat may see it. */
interface AgentCard {
  readonly id: string;
  readonly face: 'up' | 'down';
  /** The card's name, or null where its face is hidden from this seat. */
  readonly name: string | null;
  /** The text written on its face, where the seat sees the face and the card has any. */
  readonly text?: string;
}

/** A hand as this seat is shown it. */
interface AgentHand {
  readonly holder: string;
  readonly kind: 'seat' | 'piece';
  readonly count: number;
  /** Whether this seat holds for the hand: plays from it, gives from it and draws into it. */
  readonly yours: boolean;
  /** The cards, where this seat sees the hand. */
  readonly cards?: readonly AgentCard[];
}

/**
 * The tools for decks, cards and hands (tyoitashi), as the linked seat: each goes the way the seat's
 * own hand would, through the same rules the hand rail and the deck's menu keep, so the room's
 * switches for drawing and giving hold for the AI as for anyone, and a room server checks them too.
 */
@Injectable({ providedIn: 'root' })
export class AgentCardTools {
  private readonly cardGame = inject(CardGameService);
  private readonly objectStore = inject(ObjectStore);
  private readonly tabletop = inject(TabletopService);
  private readonly permission = inject(RolePermissionService);

  readonly handlers: Readonly<Record<string, AgentHandler>> = {
    list_cards: () => this.list(),
    draw_card: (args) => this.draw(args),
    deal_cards: (args) => this.deal(args),
    give_card: (args) => this.give(args),
    take_card: (args) => this.take(args),
    play_card: (args) => this.play(args),
    flip_card: (args) => {
      const card = this.tableCard(textArg(args, 'card'));
      if (textArg(args, 'face') === 'down') card.faceDown();
      else card.faceUp();
      SoundEffect.play(PresetSound.cardPick);
      return this.cardView(card);
    },
    shuffle_deck: (args) => {
      const deck = this.deck(textArg(args, 'deck'));
      deck.shuffle();
      SoundEffect.play(PresetSound.cardShuffle);
      return { deck: { id: deck.identifier, name: deck.name, count: deck.cards.length } };
    },
  };

  private list(): unknown {
    const grid = this.tabletop.gridSize();
    const tableCards = this.objectStore
      .getObjects<Card>(Card)
      .filter((card) => card.location.name === 'table' && card.isVisibleOnTable);
    return {
      rules: { drawFromOthers: this.cardGame.allowsHandDraw(), giveToOthers: this.cardGame.allowsHandGive() },
      decks: this.decks().map((deck) => ({
        id: deck.identifier,
        name: deck.name,
        count: deck.cards.length,
        square: this.squareAt(deck.location.x, deck.location.y, grid),
      })),
      table: tableCards.map((card) => ({
        ...this.cardView(card),
        square: this.squareAt(card.location.x, card.location.y, grid),
      })),
      hands: this.hands(),
    };
  }

  private hands(): AgentHand[] {
    const held = new Set(this.cardGame.heldHands().map((seat) => seat.userId));
    return this.cardGame.dealSeats().map((seat) => {
      const cards = this.cardGame.handCardsOf(seat.userId);
      const shown = held.has(seat.userId) || this.cardGame.handPublicOf(seat.userId);
      return {
        holder: seat.name,
        kind: seat.characterIdentifier ? 'piece' : 'seat',
        count: cards.length,
        yours: held.has(seat.userId),
        ...(shown ? { cards: cards.map((card) => this.cardView(card)) } : {}),
      };
    });
  }

  private draw(args: Readonly<Record<string, unknown>>): unknown {
    const deck = this.deck(textArg(args, 'deck'));
    const holder = this.heldHolder(textArg(args, 'into'));
    const count = Math.max(1, Math.floor(numberArg(args, 'count', 1)));
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      const card = deck.drawCard();
      if (!card) break;
      card.toHand(holder.userId);
      drawn.push(card);
    }
    if (drawn.length === 0) throw new AgentToolError('failed', `The deck ${deck.name} is empty.`);
    deck.update();
    SoundEffect.play(PresetSound.cardDraw);
    return { into: holder.name, drawn: drawn.map((card) => this.cardView(card)), left: deck.cards.length };
  }

  private deal(args: Readonly<Record<string, unknown>>): unknown {
    const deck = this.deck(textArg(args, 'deck'));
    const names = (args['to'] as readonly string[] | undefined) ?? [];
    const holders = names.length > 0 ? names.map((name) => this.anyHolder(name).userId) : undefined;
    const result = this.cardGame.dealAll(deck, Math.floor(numberArg(args, 'keep_jokers', 1)), holders);
    if (result.participants === 0) throw new AgentToolError('failed', 'Nobody can be dealt cards.');
    return { dealt: result.dealt, hands: result.participants, leftInDeck: deck.cards.length };
  }

  private give(args: Readonly<Record<string, unknown>>): unknown {
    const card = this.card(textArg(args, 'card'));
    const recipient = this.anyHolder(textArg(args, 'to'));
    if (card.location.name === 'table') {
      if (!this.cardGame.giveFromTable(card, recipient.userId)) {
        throw new AgentToolError('not_allowed', `This card cannot be given from the table to ${recipient.name} now.`);
      }
      return { given: card.identifier, to: recipient.name };
    }
    const from = this.holderOfCard(card);
    if (!from || !this.cardGame.canGiveFrom(from)) {
      throw new AgentToolError(
        'not_allowed',
        'This seat may give only from its own hand or the hand of a piece it owns.'
      );
    }
    if (!this.cardGame.giveFromHand(card, recipient.userId, from)) {
      throw new AgentToolError('not_allowed', `This card cannot be given to ${recipient.name} now.`);
    }
    return { given: card.identifier, to: recipient.name };
  }

  private take(args: Readonly<Record<string, unknown>>): unknown {
    const from = this.anyHolder(textArg(args, 'from'));
    if (!this.cardGame.allowsHandDraw()) {
      throw new AgentToolError('not_allowed', "The room does not let anyone draw from another's hand.");
    }
    const cards = this.cardGame.handCardsOf(from.userId);
    if (cards.length === 0) throw new AgentToolError('failed', `${from.name} holds no cards.`);
    const wanted = textArg(args, 'card').trim();
    const card = wanted
      ? cards.find((one) => one.identifier === wanted)
      : cards[Math.floor(Math.random() * cards.length)];
    if (!card) throw new AgentToolError('not_found', `${from.name} holds no card with the id ${wanted}.`);
    if (!this.cardGame.drawFromHand(card, from.name)) {
      throw new AgentToolError('not_allowed', `This seat cannot draw from ${from.name} now.`);
    }
    return { took: this.cardView(card), from: from.name };
  }

  private play(args: Readonly<Record<string, unknown>>): unknown {
    const card = this.card(textArg(args, 'card'));
    const from = this.holderOfCard(card);
    if (!from || !this.cardGame.canHoldFor(from)) {
      throw new AgentToolError(
        'not_allowed',
        'This seat may play only from its own hand or the hand of a piece it owns.'
      );
    }
    const grid = this.tabletop.gridSize();
    const col = numberArg(args, 'col', 0);
    const row = numberArg(args, 'row', 0);
    if (col > 0 && row > 0) {
      card.location.x = (col - 1) * grid;
      card.location.y = (row - 1) * grid;
    }
    if (textArg(args, 'face') === 'down') card.playFaceDown();
    else card.playFaceUp();
    card.toTopmost();
    SoundEffect.play(PresetSound.cardPut);
    return { ...this.cardView(card), square: this.squareAt(card.location.x, card.location.y, grid) };
  }

  /** A card as this seat is shown it. */
  private cardView(card: Card): AgentCard {
    const sees = card.isVisible || (this.permission.canSeeHidden() && !card.isFaceWithheld);
    const text = sees ? card.faceText : '';
    return {
      id: card.identifier,
      face: card.isFront ? 'up' : 'down',
      name: sees ? card.name : null,
      ...(text ? { text } : {}),
    };
  }

  private decks(): CardStack[] {
    return this.objectStore
      .getObjects<CardStack>(CardStack)
      .filter((deck) => deck.location.name === 'table' && deck.isVisibleOnTable);
  }

  private deck(reference: string): CardStack {
    return findOne(
      this.decks(),
      reference,
      (deck) => deck.identifier,
      (deck) => deck.name,
      'deck'
    );
  }

  /** A card this seat may name: on the table, or in a hand it sees. Hidden faces are known by id alone. */
  private card(reference: string): Card {
    const wanted = reference.trim();
    const card = this.objectStore.get(wanted);
    if (card instanceof Card && (card.location.name === 'table' || isHandLocation(card.location.name))) return card;
    const named = this.objectStore
      .getObjects<Card>(Card)
      .filter((one) => this.cardView(one).name !== null && (one.location.name === 'table' || this.isInHeldHand(one)));
    return findOne(
      named,
      wanted,
      (one) => one.identifier,
      (one) => one.name,
      'card'
    );
  }

  private tableCard(reference: string): Card {
    const card = this.card(reference);
    if (card.location.name !== 'table') throw new AgentToolError('failed', 'That card is not on the table.');
    return card;
  }

  /** The hand a card is in, or null for a card on the table. */
  private holderOfCard(card: Card): string | null {
    const name = card.location.name;
    if (!isHandLocation(name)) return null;
    return this.cardGame.dealSeats().find((seat) => handLocationOf(seat.userId) === name)?.userId ?? null;
  }

  private isInHeldHand(card: Card): boolean {
    const holder = this.holderOfCard(card);
    return holder !== null && this.cardGame.canHoldFor(holder);
  }

  /** A hand this seat holds for, its own where none is named. */
  private heldHolder(reference: string): CardSeat {
    const held = this.cardGame.heldHands();
    if (held.length === 0) throw new AgentToolError('not_allowed', 'This seat holds no hand.');
    if (!reference.trim()) return held[0];
    return findOne(
      held,
      reference,
      (seat) => seat.characterIdentifier ?? seat.userId,
      (seat) => seat.name,
      'hand'
    );
  }

  /** Any hand in the room, by the name of its seat or piece. */
  private anyHolder(reference: string): CardSeat {
    return findOne(
      this.cardGame.dealSeats(),
      reference,
      (seat) => seat.characterIdentifier ?? seat.userId,
      (seat) => seat.name,
      'hand'
    );
  }

  private squareAt(x: number, y: number, grid: number): { col: number; row: number } {
    return { col: Math.floor(x / grid) + 1, row: Math.floor(y / grid) + 1 };
  }
}
