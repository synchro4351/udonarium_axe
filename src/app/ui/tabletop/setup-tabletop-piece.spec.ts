import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GameCharacter } from '@axe/domain/character/game-character';
import { GridSnapStyle } from '@axe/domain/tabletop/game-table';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';
import { MovableOption } from '@axe/ui/directives/movable.directive';
import { RotableOption } from '@axe/ui/directives/rotable.directive';
import { setupMovableRotableForPiece } from '@axe/ui/tabletop/setup-tabletop-piece';

describe('setupMovableRotableForPiece', () => {
  let character: GameCharacter;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    character = GameCharacter.create('walker', 0.5, '');
  });

  afterEach(() => character.destroy());

  function setUp(): () => MovableOption {
    const movableOption = signal<MovableOption>({});
    const rotableOption = signal<RotableOption>({});
    TestBed.runInInjectionContext(() =>
      setupMovableRotableForPiece<GameCharacter>(
        { movableOption, rotableOption },
        {
          target: signal(character),
          snapStyle: (piece) => (piece.size % 1 !== 0 ? GridSnapStyle.VERTEX : undefined),
        }
      )
    );
    TestBed.tick();
    return movableOption;
  }

  it('reads the snap style again at each snap, so a character resized after it was set up snaps by its new size', () => {
    const option = setUp();
    expect(option().snapStyleOf?.()).toBe(GridSnapStyle.VERTEX);

    character.size = 1;

    expect(option().snapStyleOf?.()).toBeUndefined();
  });

  it('leaves a fixed snap style as it is, with nothing to read again', () => {
    const movableOption = signal<MovableOption>({});
    const rotableOption = signal<RotableOption>({});
    TestBed.runInInjectionContext(() =>
      setupMovableRotableForPiece<GameCharacter>(
        { movableOption, rotableOption },
        { target: signal(character), snapStyle: GridSnapStyle.BOTH }
      )
    );
    TestBed.tick();

    expect(movableOption().snapStyle).toBe(GridSnapStyle.BOTH);
    expect(movableOption().snapStyleOf).toBeUndefined();
  });
});
