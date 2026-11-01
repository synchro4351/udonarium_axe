import { ObjectStore } from '@axe/core/sync/object-store';
import { Card } from '@axe/domain/card/card';
import { handHolderForCharacter, seesCharacterHand } from '@axe/domain/card/character-hands';
import { characterHandHolderOf, characterOfHandHolder } from '@axe/domain/card/hand-location';
import { GameCharacter } from '@axe/domain/character/game-character';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';

describe('character hands', () => {
  const made: { destroy(): void }[] = [];

  function character(name: string, owner = ''): GameCharacter {
    const piece = GameCharacter.create(name, 1, '');
    piece.owner = owner;
    made.push(piece);
    return piece;
  }

  beforeEach(() => {
    PeerCursor.myCursor = null!;
    PeerCursor.createMyCursor();
    PeerCursor.myCursor.userId = 'me';
    PeerCursor.myCursor.role = PeerRole.Player;
  });

  afterEach(() => {
    for (const object of made.splice(0)) object.destroy();
    for (const cursor of ObjectStore.instance.getObjects<PeerCursor>(PeerCursor)) {
      if (cursor !== PeerCursor.myCursor) ObjectStore.instance.delete(cursor, false);
    }
  });

  it('holds a character hand under a holder that reads back to the character and never to a user', () => {
    expect(characterOfHandHolder(characterHandHolderOf('abc'))).toBe('abc');
    expect(characterOfHandHolder('some-user-id')).toBeNull();
    expect(characterOfHandHolder('chr:')).toBeNull();
  });

  it('lets the owner and the game master see a character hand, and nobody else', () => {
    const mine = character('ブレイズ', 'me');
    const npc = character('ゴブリン');

    expect(seesCharacterHand(mine, { userId: 'me', role: PeerRole.Player })).toBe(true);
    expect(seesCharacterHand(mine, { userId: 'other', role: PeerRole.Player })).toBe(false);
    expect(seesCharacterHand(npc, { userId: 'me', role: PeerRole.Player })).toBe(false);
    expect(seesCharacterHand(npc, { userId: 'gm', role: PeerRole.GameMaster })).toBe(true);
    expect(seesCharacterHand(mine, { userId: '', role: PeerRole.Guest })).toBe(false);
  });

  it("shows the front of a card in a character's hand to its owner only", () => {
    const mine = character('ブレイズ', 'me');
    const theirs = character('ローゼ', 'other');
    const own = Card.create('a', 'front', 'back');
    const other = Card.create('b', 'front', 'back');
    made.push(own, other);

    own.toHand(handHolderForCharacter(mine));
    other.toHand(handHolderForCharacter(theirs));

    expect(own.isVisible).toBe(true);
    expect(other.isVisible).toBe(false);
    PeerCursor.myCursor.role = PeerRole.GameMaster;
    expect(other.isVisible).toBe(true);
  });
});
