import { CardStack } from '@axe/domain/card/card-stack';
import { buildCardStackContextMenu } from '@axe/features/card/card-stack/card-stack-context-menu';
import { createSyncTranslate } from '@axe/testing/transloco-testing';

const t = createSyncTranslate('ja');

describe('buildCardStackContextMenu', () => {
  it('offers drawing to the hand and drawing several right below drawing one, and does each', () => {
    const cardStack = CardStack.create('test stack');
    const onDrawCard = vi.fn();
    const onDrawToHand = vi.fn();
    const onDrawCards = vi.fn();

    try {
      const actions = buildCardStackContextMenu(
        cardStack,
        50,
        onDrawCard,
        onDrawToHand,
        onDrawCards,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        t
      );
      const drawIndex = actions.findIndex((action) => action.name === '１枚引く');

      expect(drawIndex).toBeGreaterThanOrEqual(0);
      expect(actions[drawIndex + 1].name).toBe('１枚引いて手札に加える');
      expect(actions[drawIndex + 2].name).toBe('X枚を引く');

      actions[drawIndex + 1].action?.();
      actions[drawIndex + 2].action?.();

      expect(onDrawToHand).toHaveBeenCalledOnce();
      expect(onDrawCards).toHaveBeenCalledOnce();
    } finally {
      cardStack.destroy();
    }
  });

  it('offers giving the top card to a participant right after drawing it into the hand', () => {
    const cardStack = CardStack.create('test stack');
    const give = { name: 'あいて に渡す', action: vi.fn() };
    try {
      const build = (giveActions: { name: string; action: () => void }[]) =>
        buildCardStackContextMenu(
          cardStack,
          50,
          vi.fn(),
          vi.fn(),
          vi.fn(),
          vi.fn(),
          vi.fn(),
          vi.fn(),
          vi.fn(),
          vi.fn(),
          t,
          giveActions
        );

      const actions = build([give]);
      const toHandIndex = actions.findIndex((action) => action.name === '１枚引いて手札に加える');
      expect(actions[toHandIndex + 1].name).toBe('一番上のカードを渡す');
      expect(actions[toHandIndex + 1].subActions).toEqual([give]);

      expect(build([]).map((action) => action.name)).not.toContain('一番上のカードを渡す');
    } finally {
      cardStack.destroy();
    }
  });

  it('offers dealing the deck out before splitting it', () => {
    const cardStack = CardStack.create('test stack');
    try {
      const actions = buildCardStackContextMenu(
        cardStack,
        50,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        t
      );
      const dealIndex = actions.findIndex((action) => action.name === '全員に配り切る');

      expect(dealIndex).toBeGreaterThanOrEqual(0);
      expect(actions[dealIndex + 1].name).toBe('山札を人数分に分割する');
    } finally {
      cardStack.destroy();
    }
  });

  it('no longer offers the card list, which the sheet now holds', () => {
    const cardStack = CardStack.create('test stack');
    try {
      const actions = buildCardStackContextMenu(
        cardStack,
        50,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        t
      );
      expect(actions.some((action) => action.name === 'カード一覧')).toBe(false);
    } finally {
      cardStack.destroy();
    }
  });
});
