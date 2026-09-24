import { Card } from '@axe/domain/card/card';
import { isHandCardOf, selectHandCardsOf } from '@axe/domain/card/hand-cards';
import { trumpCodeOf } from '@axe/domain/card/trump-card';

export { isHandCardOf };

/** The cards in the given user's hand, in the order the hand rail lays them out. */
export function selectHandCards(cards: readonly Card[], userId: string): Card[] {
  return selectHandCardsOf(cards, userId);
}

/** A view of the hand with bundled playing cards by suit and number, then custom cards by name. */
export function autoSortHandCards(cards: readonly Card[]): Card[] {
  const suits = 'cdhsx';
  return [...cards].sort((left, right) => {
    const a = trumpCodeOf(left);
    const b = trumpCodeOf(right);
    if (a && b) {
      const bySuit = suits.indexOf(a[0]) - suits.indexOf(b[0]);
      if (bySuit) return bySuit;
      const byNumber = Number(a.slice(1)) - Number(b.slice(1));
      if (byNumber) return byNumber;
    } else if (a || b) {
      return a ? -1 : 1;
    }
    return left.name.localeCompare(right.name, 'ja') || left.handOrder - right.handOrder;
  });
}

/**
 * A copy of the hand with the card at `from` moved into the gap at `insertAt`.
 *
 * The gap is counted along the hand as it stands before the move, so dropping a card just past
 * itself keeps it in place. An out-of-range `from` returns the hand unchanged, and a gap past
 * either end is clamped to that end.
 */
export function reorderHandCards(cards: readonly Card[], from: number, insertAt: number): Card[] {
  if (from < 0 || from >= cards.length) return [...cards];

  const next = [...cards];
  const [moved] = next.splice(from, 1);
  const target = insertAt > from ? insertAt - 1 : insertAt;
  next.splice(Math.max(0, Math.min(next.length, target)), 0, moved);

  return next;
}
