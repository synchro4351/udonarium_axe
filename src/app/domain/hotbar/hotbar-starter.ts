import { emptyHotbarSlotDraft, HotbarSlotDraft } from '@axe/domain/hotbar/hotbar-draft';
import { HOTBAR_SLOTS_PER_PAGE, HotbarCell } from '@axe/domain/hotbar/hotbar-size';

export interface HotbarStarterSlot {
  cell: HotbarCell;
  draft: HotbarSlotDraft;
}

/** The lines the samples write into the chat box: two common rolls and a pick from a list. */
const STARTER_LINES: readonly { value: string; icon: string }[] = [
  { value: '1D100', icon: 'casino' },
  { value: '2D6', icon: 'casino' },
  { value: 'choice[A,B,C]', icon: 'shuffle' },
];

/**
 * The few slots a reader's first bar starts with, to show what a slot is for.
 *
 * Each one only writes a line into the chat box and sends nothing, so pressing one by accident
 * does no harm, and none of them needs a character or a GM to work. They sit at the end of
 * the first page, leaving the first keys and the first free slots to what the reader puts
 * there, and are ordinary slots to edit or clear.
 */
export function hotbarStarterSlots(): HotbarStarterSlot[] {
  const first = HOTBAR_SLOTS_PER_PAGE - STARTER_LINES.length;
  return STARTER_LINES.map(({ value, icon }, order) => {
    const draft = emptyHotbarSlotDraft('prefill');
    draft.value = value;
    draft.icon = icon;
    return { cell: { page: 0, slotIndex: first + order }, draft };
  });
}
