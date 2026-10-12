import type { TranslateFn } from '@axe/application/i18n/translate.token';
import {
  buildHandCardContextMenu,
  buildPlayDroppedCardMenu,
} from '@axe/features/card/hand-rail/hand-card-context-menu';
import { createSyncTranslate } from '@axe/testing/transloco-testing';

const t = createSyncTranslate('ja');
const names = (menu: { name: string }[]) => menu.map((entry) => entry.name);

describe('buildHandCardContextMenu()', () => {
  it('groups recipients under a give entry and offers editing when permitted', () => {
    const onEdit = vi.fn();
    const give = { name: 'あいて に渡す', action: vi.fn() };

    const menu = buildHandCardContextMenu({ giveActions: [give], canEdit: true, onEdit }, t);

    expect(names(menu)).toEqual(['カードを渡す', 'カードを編集']);
    expect(menu[0].subActions).toEqual([give]);
    menu[1].action?.();
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('leaves out editing while the room keeps card edits from this user', () => {
    const menu = buildHandCardContextMenu(
      { giveActions: [{ name: 'あいて に渡す', action: vi.fn() }], canEdit: false, onEdit: vi.fn() },
      t
    );

    expect(names(menu)).toEqual(['カードを渡す']);
  });

  it('leaves out giving when there is nobody to give to', () => {
    expect(names(buildHandCardContextMenu({ giveActions: [], canEdit: true, onEdit: vi.fn() }, t))).toEqual([
      'カードを編集',
    ]);
    expect(buildHandCardContextMenu({ giveActions: [], canEdit: false, onEdit: vi.fn() }, t)).toEqual([]);
  });
});

describe('the menu of how a card dropped from the hand lies', () => {
  it('offers face up, then face down', () => {
    const play = vi.fn();
    const menu = buildPlayDroppedCardMenu(play, ((key: string) => key) as TranslateFn);

    expect(menu.map((entry) => entry.name)).toEqual(['feature.card.hand.playFaceUp', 'feature.card.hand.playFaceDown']);
    menu[0].action!();
    menu[1].action!();
    expect(play.mock.calls).toEqual([[true], [false]]);
  });
});
