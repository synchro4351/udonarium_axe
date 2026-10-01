import { hotbarSlotLabel } from '@axe/domain/hotbar/hotbar-appearance';
import { holdsHotbarCell } from '@axe/domain/hotbar/hotbar-size';
import { hotbarSlotNeedsCharacter } from '@axe/domain/hotbar/hotbar-slot-kind';
import { HotbarStarterLabels, hotbarStarterSlots } from '@axe/domain/hotbar/hotbar-starter';

const LABELS: HotbarStarterLabels = { sheet: 'シート', focus: 'コマへ' };

describe('hotbarStarterSlots', () => {
  it('offers three samples, each in a cell of its own on the first page', () => {
    const starter = hotbarStarterSlots(LABELS);
    const cells = starter.map(({ cell }) => `${cell.page}:${cell.slotIndex}`);

    expect(starter).toHaveLength(3);
    expect(new Set(cells).size).toBe(starter.length);
    for (const { cell } of starter) {
      expect(holdsHotbarCell(cell)).toBe(true);
      expect(cell.page).toBe(0);
    }
  });

  it('leaves the first keys of the bar free for the reader', () => {
    for (const { cell } of hotbarStarterSlots(LABELS)) expect(cell.slotIndex).toBeGreaterThanOrEqual(5);
  });

  it('shows a different kind of slot in each, none of which sends anything to the room', () => {
    const kinds = hotbarStarterSlots(LABELS).map(({ draft }) => draft.kind);

    expect(kinds).toEqual(['prefill', 'panel', 'focus']);
  });

  it('only drafts the roll into the chat box, needing nobody to act as', () => {
    const [roll] = hotbarStarterSlots(LABELS);

    expect(roll.draft.kind).toBe('prefill');
    expect(roll.draft.value).toBe('1D100');
    expect(hotbarSlotNeedsCharacter(roll.draft.kind)).toBe(false);
    expect(hotbarSlotLabel(roll.draft.value, roll.draft.label)).toBe('1D100');
  });

  it('opens the character sheet and looks at the piece of whoever the chat speaks as', () => {
    const [, sheet, focus] = hotbarStarterSlots(LABELS);

    expect(sheet.draft.payload).toEqual({ kind: 'panel', panel: 'sheet' });
    expect(sheet.draft.label).toBe('シート');
    expect(focus.draft.label).toBe('コマへ');
    for (const { draft } of [sheet, focus]) {
      expect(hotbarSlotNeedsCharacter(draft.kind)).toBe(true);
      expect(draft.characterIdentifier).toBe('');
      expect(draft.characterName).toBe('');
    }
  });

  it('gives every sample a label to read on the bar', () => {
    for (const { draft } of hotbarStarterSlots(LABELS)) {
      expect(hotbarSlotLabel(draft.value, draft.label).trim()).not.toBe('');
    }
  });

  it('hands out a fresh set each time, so editing one bar never touches the next', () => {
    const first = hotbarStarterSlots(LABELS);
    first[0].draft.value = 'changed';
    first[1].draft.label = 'changed';

    const second = hotbarStarterSlots(LABELS);
    expect(second[0].draft.value).toBe('1D100');
    expect(second[1].draft.label).toBe('シート');
  });
});
