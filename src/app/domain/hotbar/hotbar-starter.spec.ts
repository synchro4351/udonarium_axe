import { holdsHotbarCell } from '@axe/domain/hotbar/hotbar-size';
import { hotbarSlotNeedsCharacter } from '@axe/domain/hotbar/hotbar-slot-kind';
import { hotbarStarterSlots } from '@axe/domain/hotbar/hotbar-starter';

describe('hotbarStarterSlots', () => {
  it('offers a few samples, each in a cell of its own on the first page', () => {
    const starter = hotbarStarterSlots();
    const cells = starter.map(({ cell }) => `${cell.page}:${cell.slotIndex}`);

    expect(starter.length).toBeGreaterThanOrEqual(2);
    expect(starter.length).toBeLessThanOrEqual(3);
    expect(new Set(cells).size).toBe(starter.length);
    for (const { cell } of starter) {
      expect(holdsHotbarCell(cell)).toBe(true);
      expect(cell.page).toBe(0);
    }
  });

  it('leaves the first keys of the bar free for the reader', () => {
    for (const { cell } of hotbarStarterSlots()) expect(cell.slotIndex).toBeGreaterThanOrEqual(5);
  });

  it('only writes into the chat box, needing no character and sending nothing', () => {
    for (const { draft } of hotbarStarterSlots()) {
      expect(draft.kind).toBe('prefill');
      expect(hotbarSlotNeedsCharacter(draft.kind)).toBe(false);
      expect(draft.value.trim()).not.toBe('');
      expect(draft.characterIdentifier).toBe('');
      expect(draft.characterName).toBe('');
    }
  });

  it('hands out a fresh set each time, so editing one bar never touches the next', () => {
    const first = hotbarStarterSlots();
    first[0].draft.value = 'changed';

    expect(hotbarStarterSlots()[0].draft.value).not.toBe('changed');
  });
});
