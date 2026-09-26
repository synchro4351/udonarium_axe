import { Card } from '@axe/domain/card/card';
import { appendHandOrderAfter, selectOrphanHands, shortUserIdOf } from '@axe/domain/card/orphan-hands';

describe('orphan-hands', () => {
  const created: Card[] = [];

  function card(location: string, handOrder = 0): Card {
    const object = Card.create('カード', 'front', 'back');
    object.setLocation(location);
    object.handOrder = handOrder;
    created.push(object);
    return object;
  }

  afterEach(() => {
    for (const object of created.splice(0)) object.destroy();
  });

  describe('selectOrphanHands()', () => {
    it('groups the hands of users not present, each in hand order', () => {
      const late = card('hand:gone', 30);
      const early = card('hand:gone', 10);
      const other = card('hand:left', 5);
      card('hand:here', 1);
      card('table');

      const hands = selectOrphanHands(created, new Set(['here']));

      expect(hands.map((hand) => hand.userId)).toEqual(['gone', 'left']);
      expect(hands[0].cards).toEqual([early, late]);
      expect(hands[1].cards).toEqual([other]);
    });

    it('finds nothing when every holder is present or no card is in a hand', () => {
      card('hand:here');
      card('table');
      card('hand:');

      expect(selectOrphanHands(created, new Set(['here']))).toEqual([]);
      expect(selectOrphanHands([], new Set())).toEqual([]);
    });
  });

  describe('shortUserIdOf()', () => {
    it('shortens a long id and leaves a short one alone', () => {
      expect(shortUserIdOf('abcdefghijkl')).toBe('abcdef…');
      expect(shortUserIdOf('abc')).toBe('abc');
    });
  });

  describe('appendHandOrderAfter()', () => {
    it('comes after the last card of the hand, never before now', () => {
      expect(appendHandOrderAfter([card('hand:x', 500)], 100)).toBe(501);
      expect(appendHandOrderAfter([card('hand:x', 50)], 100)).toBe(100);
      expect(appendHandOrderAfter([], 100)).toBe(100);
    });
  });
});
