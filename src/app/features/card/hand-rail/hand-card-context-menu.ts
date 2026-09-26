import type { TranslateFn } from '@axe/application/i18n/translate.token';
import type { ContextMenuAction } from '@axe/application/ui/context-menu.service';

/**
 * The right-click menu of a card in your own hand: a submenu of participants to give it to, and an
 * entry to edit it.
 *
 * The submenu appears only when there is someone to give to, and editing only when the room lets
 * this user edit cards; with neither, the menu is empty and should not be opened.
 */
export function buildHandCardContextMenu(
  options: { giveActions: readonly ContextMenuAction[]; canEdit: boolean; onEdit: () => void },
  t: TranslateFn
): ContextMenuAction[] {
  const menu: ContextMenuAction[] = [];
  if (options.giveActions.length > 0) {
    menu.push({ name: t('feature.card.hand.giveCard'), subActions: [...options.giveActions] });
  }
  if (options.canEdit) {
    menu.push({ name: t('feature.card.contextMenu.editCard'), action: () => options.onEdit() });
  }
  return menu;
}
