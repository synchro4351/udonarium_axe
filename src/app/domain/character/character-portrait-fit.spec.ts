import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import {
  clearPortraitFitOf,
  launchPortraitFitOf,
  portraitFitOf,
  setPortraitFitOf,
} from '@axe/domain/character/character-portrait-fit';
import { GameCharacter } from '@axe/domain/character/game-character';
import { DEFAULT_CUT_IN_PORTRAIT_FIT } from '@axe/domain/media/cut-in-portrait';

describe('character portrait fits', () => {
  const made: GameCharacter[] = [];

  function makeCharacter(name: string): GameCharacter {
    const character = GameCharacter.create(name, 1, 'shared-face');
    made.push(character);
    return character;
  }

  afterEach(() => {
    for (const character of made.splice(0)) character.destroy();
  });

  it('keeps a fit on the character for its picture', () => {
    const hero = makeCharacter('勇者');

    setPortraitFitOf(hero, 'bust', 'shared-face', { scale: 2, x: 40, y: 10 });

    expect(portraitFitOf(hero, 'bust', 'shared-face')).toEqual({ scale: 2, x: 40, y: 10 });
    expect(portraitFitOf(hero, 'bust', 'other-face')).toBeNull();
  });

  it('lets two characters that share a picture fit it independently', () => {
    const hero = makeCharacter('勇者');
    const rival = makeCharacter('宿敵');

    setPortraitFitOf(hero, 'bust', 'shared-face', { scale: 2, x: 40, y: 10 });
    setPortraitFitOf(rival, 'bust', 'shared-face', { scale: 1.3, x: 70, y: 30 });

    expect(portraitFitOf(hero, 'bust', 'shared-face')).toEqual({ scale: 2, x: 40, y: 10 });
    expect(portraitFitOf(rival, 'bust', 'shared-face')).toEqual({ scale: 1.3, x: 70, y: 30 });
  });

  it('puts a picture back to the default on reset', () => {
    const hero = makeCharacter('勇者');
    setPortraitFitOf(hero, 'bust', 'shared-face', { scale: 2, x: 40, y: 10 });

    clearPortraitFitOf(hero, 'bust', 'shared-face');

    expect(portraitFitOf(hero, 'bust', 'shared-face')).toBeNull();
    expect(launchPortraitFitOf(hero, 'bust', 'shared-face')).toEqual(DEFAULT_CUT_IN_PORTRAIT_FIT);
  });

  it('launches with its own fit once it has one, and with the default until then', () => {
    const hero = makeCharacter('勇者');

    expect(launchPortraitFitOf(hero, 'bust', 'shared-face')).toEqual(DEFAULT_CUT_IN_PORTRAIT_FIT);
    expect(launchPortraitFitOf(null, 'bust', 'shared-face')).toEqual(DEFAULT_CUT_IN_PORTRAIT_FIT);
    setPortraitFitOf(hero, 'bust', 'shared-face', { scale: 2, x: 40, y: 10 });
    expect(launchPortraitFitOf(hero, 'bust', 'shared-face')).toEqual({ scale: 2, x: 40, y: 10 });
  });

  it('travels with the character in its save data and comes back on load', () => {
    // A saved room, an exported character and a peer joining late all read the character from this.
    const hero = makeCharacter('勇者');
    setPortraitFitOf(hero, 'bust', 'shared-face', { scale: 2, x: 40, y: 10 });

    // The whole sheet is more than the test DOM's XML parser takes, so the attribute the save
    // writes is read back on its own, the way a load reads it.
    const written = hero.toXml().match(/\sportraitFits="[^"]*"/)?.[0] ?? '';
    const restored = ObjectSerializer.instance.parseXml(`<character${written}></character>`) as GameCharacter;
    made.push(restored);

    expect(written).not.toBe('');
    expect(restored).toBeInstanceOf(GameCharacter);
    expect(portraitFitOf(restored, 'bust', 'shared-face')).toEqual({ scale: 2, x: 40, y: 10 });
  });

  it('travels to other peers as part of what the character syncs', () => {
    const hero = makeCharacter('勇者');
    setPortraitFitOf(hero, 'bust', 'shared-face', { scale: 2, x: 40, y: 10 });

    const copy = new GameCharacter('peer-copy');
    made.push(copy);
    copy.apply({ ...hero.toContext(), identifier: 'peer-copy' });

    expect(portraitFitOf(copy, 'bust', 'shared-face')).toEqual({ scale: 2, x: 40, y: 10 });
  });

  it('loads a character saved before fits existed with none', () => {
    const restored = ObjectSerializer.instance.parseXml('<character name="勇者"></character>') as GameCharacter;
    made.push(restored);

    expect(restored.portraitFits).toBe('');
    expect(portraitFitOf(restored, 'bust', 'shared-face')).toBeNull();
  });
});
