import { Card } from '@axe/domain/card/card';
import { handHolderOf } from '@axe/domain/card/hand-location';

/** How many leading characters of a user id are shown to tell absent participants apart. */
const SHORT_USER_ID_LENGTH = 6;

/** A hand whose holder is no longer in the room, with its cards in hand order. */
export interface OrphanHand {
  userId: string;
  cards: Card[];
}

/**
 * The hands held by nobody in the room: every hand location whose user is not among the present
 * ones, each with at least one card.
 *
 * Cards keep their hand order, and the hands are sorted by user id so the list stays still while
 * cards come and go.
 */
export function selectOrphanHands(cards: readonly Card[], presentUserIds: ReadonlySet<string>): OrphanHand[] {
  const byUser = new Map<string, Card[]>();
  for (const card of cards) {
    const holder = handHolderOf(card.location.name);
    if (holder === null || presentUserIds.has(holder)) continue;
    const hand = byUser.get(holder);
    if (hand) hand.push(card);
    else byUser.set(holder, [card]);
  }
  return [...byUser.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([userId, hand]) => ({ userId, cards: hand.sort((a, b) => a.handOrder - b.handOrder) }));
}

/**
 * A short label for an absent user id, enough to tell two orphaned hands apart without spelling out
 * the whole id, which is what a returning participant reconnects with.
 */
export function shortUserIdOf(userId: string): string {
  return userId.length > SHORT_USER_ID_LENGTH ? `${userId.slice(0, SHORT_USER_ID_LENGTH)}…` : userId;
}

/** The hand order that puts a card after every card already in a hand, and no earlier than now. */
export function appendHandOrderAfter(existing: readonly Card[], now: number): number {
  const last = existing.reduce((max, card) => Math.max(max, card.handOrder), Number.NEGATIVE_INFINITY);
  return Math.max(now, last + 1);
}
