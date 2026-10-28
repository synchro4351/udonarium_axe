import type { TranslateFn } from '@axe/application/i18n/translate.token';
import type { ContextMenuAction } from '@axe/application/ui/context-menu.service';
import type { CardSeat } from '@axe/features/card/card-game.service';

/** Recipient choices for a card held in the local user's hand. */
export function handTransferActions(
  seats: readonly CardSeat[],
  onGive: (userId: string) => void,
  t: TranslateFn
): ContextMenuAction[] {
  return seats.map((seat) => ({
    name: t('feature.card.hand.giveTo', { name: seat.name }),
    action: () => onGive(seat.userId),
  }));
}
