import { emptyHotbarSlotDraft, HotbarSlotDraft } from '@axe/domain/hotbar/hotbar-draft';
import { HOTBAR_SLOTS_PER_PAGE, HotbarCell } from '@axe/domain/hotbar/hotbar-size';

export interface HotbarStarterSlot {
  cell: HotbarCell;
  draft: HotbarSlotDraft;
}

/** The words the samples that act as a character go by, in the reader's own language. */
export interface HotbarStarterLabels {
  sheet: string;
  focus: string;
}

/**
 * The few slots a reader's first bar starts with, each a different kind, to show how much one
 * slot can hold.
 *
 * One writes a roll into the chat box, one opens the character sheet, and one brings the view to
 * the piece. None of them sends a word to the room or changes the table, so pressing one by
 * accident does no harm. The last two name nobody and act as whoever the chat speaks as, which is
 * how the bar already says a character is wanted: they stay dimmed until the chat speaks as one,
 * and say so when pressed before then. They sit at the end of the first page, leaving the first
 * keys and the first free slots to what the reader puts there, and are ordinary slots to edit or
 * clear.
 */
export function hotbarStarterSlots(labels: HotbarStarterLabels): HotbarStarterSlot[] {
  const roll = emptyHotbarSlotDraft('prefill');
  roll.value = '1D100';
  roll.icon = 'casino';

  const sheet = emptyHotbarSlotDraft('panel');
  sheet.payload = { kind: 'panel', panel: 'sheet' };
  sheet.label = labels.sheet;

  const focus = emptyHotbarSlotDraft('focus');
  focus.label = labels.focus;

  const drafts = [roll, sheet, focus];
  const first = HOTBAR_SLOTS_PER_PAGE - drafts.length;
  return drafts.map((draft, order) => ({ cell: { page: 0, slotIndex: first + order }, draft }));
}
