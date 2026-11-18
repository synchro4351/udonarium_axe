import { Hotbar } from '@axe/domain/hotbar/hotbar';
import { emptyHotbarSlotDraft } from '@axe/domain/hotbar/hotbar-draft';
import {
  emptyHotbarPage,
  encodeHotbarOffer,
  HotbarOffer,
  offerOfPage,
  parseHotbarOffer,
  placeHotbarOffer,
} from '@axe/domain/hotbar/hotbar-offer';
import { HOTBAR_PAGES } from '@axe/domain/hotbar/hotbar-size';

describe('hotbar offer', () => {
  let hotbar: Hotbar;

  function chat(value: string) {
    const draft = emptyHotbarSlotDraft('chat');
    draft.value = value;
    return draft;
  }

  function spell(): HotbarOffer {
    const group = emptyHotbarSlotDraft('group');
    group.payload = {
      kind: 'group',
      steps: [
        { page: 0, slotIndex: 0, slotIdentifier: '', delayMs: 0 },
        { page: 0, slotIndex: 1, slotIdentifier: '', delayMs: 800 },
      ],
    };
    return {
      title: '炎の魔法',
      slots: [
        { slotIndex: 0, draft: chat('炎よ、来たれ') },
        { slotIndex: 1, draft: chat('2d6+{魔力} 魔法攻撃') },
        { slotIndex: 2, draft: group },
      ],
    };
  }

  beforeEach(() => {
    hotbar = new Hotbar();
    hotbar.initialize();
  });

  it('reads back what it writes', () => {
    const read = parseHotbarOffer(encodeHotbarOffer(spell()));

    expect(read?.title).toBe('炎の魔法');
    expect(read?.slots.map((slot) => slot.draft.value)).toEqual(['炎よ、来たれ', '2d6+{魔力} 魔法攻撃', '']);
  });

  it('reads nothing from a line that holds no slot, and leaves out slots off the page', () => {
    expect(parseHotbarOffer('')).toBeNull();
    expect(parseHotbarOffer('not json')).toBeNull();
    expect(parseHotbarOffer(JSON.stringify({ title: 'x', slots: [] }))).toBeNull();

    const offer = spell();
    offer.slots.push({ slotIndex: 10, draft: chat('off the page') });
    expect(parseHotbarOffer(encodeHotbarOffer(offer))?.slots).toHaveLength(3);
  });

  it('lands on the first empty page, its group pointed at the slots of that page', () => {
    hotbar.put(0, 4, chat('mine'));
    const page = emptyHotbarPage(hotbar)!;

    expect(page).toBe(1);
    expect(placeHotbarOffer(hotbar, page, spell())).toBe(3);

    const group = hotbar.slotAt(1, 2)!.options;
    expect(group.kind === 'group' && group.steps.map((step) => [step.page, step.slotIndex])).toEqual([
      [1, 0],
      [1, 1],
    ]);
    expect(hotbar.slotAt(0, 4)?.argument).toBe('mine');
  });

  it('finds no page where every page holds something', () => {
    for (let page = 0; page < HOTBAR_PAGES; page++) hotbar.put(page, 0, chat('full'));

    expect(emptyHotbarPage(hotbar)).toBeNull();
    expect(emptyHotbarPage(null)).toBe(0);
  });

  it('hands a page round with the pieces its slots named let go of', () => {
    const bound = chat('斬る');
    bound.characterIdentifier = 'piece-1';
    bound.characterName = 'アリス';
    hotbar.put(2, 3, bound);

    const offer = offerOfPage(hotbar, 2, ' アリスの剣 ')!;

    expect(offer.title).toBe('アリスの剣');
    expect(offer.slots).toEqual([
      { slotIndex: 3, draft: expect.objectContaining({ value: '斬る', characterIdentifier: '', characterName: '' }) },
    ]);
    expect(offerOfPage(hotbar, 0, 'empty')).toBeNull();
  });
});
