import type { TranslateFn } from '@axe/application/i18n/translate.token';
import type { ContextMenuAction } from '@axe/application/ui/context-menu.service';
import type { CardSeat } from '@axe/features/card/card-game.service';

/**
 * Recipient choices for giving a card, each named for the hand it goes to, as the hand rail names
 * them; a seat with no name is called unnamed rather than left blank.
 */
export function handTransferActions(
  seats: readonly CardSeat[],
  onGive: (userId: string) => void,
  t: TranslateFn
): ContextMenuAction[] {
  return seats.map((seat) => ({
    name: seat.name || t('feature.card.hand.unnamed'),
    action: () => onGive(seat.userId),
  }));
}
