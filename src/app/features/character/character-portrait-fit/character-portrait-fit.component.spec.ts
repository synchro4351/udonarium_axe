import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { portraitFitOf, setPortraitFitOf } from '@axe/domain/character/character-portrait-fit';
import { GameCharacter } from '@axe/domain/character/game-character';
import { DataElement } from '@axe/domain/data/data-element';
import { DEFAULT_CUT_IN_PORTRAIT_FIT } from '@axe/domain/media/cut-in-portrait';
import { CharacterPortraitFitComponent } from '@axe/features/character/character-portrait-fit/character-portrait-fit.component';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('CharacterPortraitFitComponent', () => {
  let fixture: ComponentFixture<CharacterPortraitFitComponent>;
  let component: CharacterPortraitFitComponent;
  let canEditTabletop: boolean;
  const made: GameCharacter[] = [];

  type Api = {
    onPointerDown(event: PointerEvent): void;
    onPointerMove(event: PointerEvent): void;
    onPointerUp(event: PointerEvent): void;
    onWheel(event: WheelEvent): void;
    onKeyDown(event: KeyboardEvent): void;
    zoomIn(): void;
  };

  function api(): Api {
    return component as unknown as Api;
  }

  function scaleOf(character: GameCharacter, image: string): number | undefined {
    return portraitFitOf(character, 'bust', image)?.scale;
  }

  function makeCharacter(name: string, images: string[]): GameCharacter {
    const character = GameCharacter.create(name, 1, images[0]);
    for (const image of images.slice(1)) {
      character.imageDataElement!.appendChild(DataElement.create('imageIdentifier', image, { type: 'image' }, ''));
    }
    made.push(character);
    return character;
  }

  function pointer(type: string, id: number, x: number, y: number): PointerEvent {
    return { type, pointerId: id, clientX: x, clientY: y, target: null, preventDefault: vi.fn() } as never;
  }

  function query(testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`);
  }

  beforeEach(async () => {
    canEditTabletop = true;
    TestBed.configureTestingModule({
      imports: [CharacterPortraitFitComponent],
      providers: [
        ...TEST_PROVIDERS,
        {
          provide: RolePermissionService,
          useValue: {
            get canEditTabletop() {
              return canEditTabletop;
            },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CharacterPortraitFitComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    for (const character of made.splice(0)) character.destroy();
  });

  it('asks for a portrait first when the character has none', () => {
    const character = makeCharacter('立ち絵なし', ['']);
    component.character.set(character);
    fixture.detectChanges();

    expect(query('portrait-fit-no-images')).not.toBeNull();
    expect(query('portrait-fit-frame')).toBeNull();
  });

  it('lists every portrait and fits the one chosen', async () => {
    const character = makeCharacter('勇者', ['smile', 'angry']);
    component.character.set(character);
    component.selectImage('angry');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="portrait-fit-choice"]')).toHaveLength(
      2
    );
    expect(component.imageIdentifier()).toBe('angry');
    expect(component.savedFit()).toBeNull();

    api().zoomIn();
    await fixture.whenStable();

    expect(scaleOf(character, 'angry')).toBeGreaterThan(1);
    expect(portraitFitOf(character, 'bust', 'smile')).toBeNull();
    expect(component.savedFit()).toEqual(portraitFitOf(character, 'bust', 'angry'));
  });

  it('leaves positions to dragging, with no slider or number fields to fill in', () => {
    const character = makeCharacter('勇者', ['smile']);
    component.character.set(character);
    fixture.detectChanges();

    expect(query('portrait-fit-frame')).not.toBeNull();
    expect(query('portrait-fit-crop')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('input')).toBeNull();
    expect(query('portrait-fit-scale')?.textContent?.trim()).toBe('100%');
  });

  it('follows the character when its fit changes from elsewhere, as another peer changing it would', async () => {
    const character = makeCharacter('勇者', ['smile']);
    component.character.set(character);
    fixture.detectChanges();

    setPortraitFitOf(character, 'bust', 'smile', { scale: 1.5, x: 20, y: 30 });
    await fixture.whenStable();

    expect(component.fit()).toEqual({ scale: 1.5, x: 20, y: 30 });
  });

  it('shows a drag as it goes and writes it to the character once, when it ends', async () => {
    const character = makeCharacter('勇者', ['smile']);
    component.character.set(character);
    fixture.detectChanges();

    api().onPointerDown(pointer('pointerdown', 1, 100, 100));
    api().onPointerMove(pointer('pointermove', 1, 140, 100));
    api().onPointerMove(pointer('pointermove', 1, 160, 100));

    expect(component.fit()).toEqual({ scale: 1, x: 60, y: 0 });
    expect(character.portraitFits).toBe('');

    const shown = component.fit();
    api().onPointerUp(pointer('pointerup', 1, 160, 100));
    await fixture.whenStable();

    expect(portraitFitOf(character, 'bust', 'smile')).toEqual(shown);
    expect(component.fit()).toEqual(shown);
  });

  it('moves a shrunk picture with the pointer, and past the edges of the frame', () => {
    const character = makeCharacter('勇者', ['smile']);
    setPortraitFitOf(character, 'bust', 'smile', { scale: 0.5, x: 0, y: 0 });
    component.character.set(character);
    fixture.detectChanges();

    api().onPointerDown(pointer('pointerdown', 1, 100, 100));
    api().onPointerMove(pointer('pointermove', 1, 30, 100));
    expect(component.fit()).toEqual({ scale: 0.5, x: -70, y: 0 });

    api().onPointerMove(pointer('pointermove', 1, -100, 300));
    api().onPointerUp(pointer('pointerup', 1, -100, 300));

    // Half the frame across, and more than half of it down.
    expect(portraitFitOf(character, 'bust', 'smile')).toEqual({ scale: 0.5, x: -200, y: 200 });
  });

  it('sizes the picture with two fingers around where they are, and moves it as they move', () => {
    const character = makeCharacter('勇者', ['smile']);
    component.character.set(character);
    fixture.detectChanges();

    api().onPointerDown(pointer('pointerdown', 1, 100, 100));
    api().onPointerDown(pointer('pointerdown', 2, 200, 100));
    api().onPointerMove(pointer('pointermove', 2, 300, 100));
    api().onPointerUp(pointer('pointerup', 2, 300, 100));
    api().onPointerUp(pointer('pointerup', 1, 100, 100));

    // Twice as far apart around their first middle (150, 100), which then moved 50 to the right.
    expect(portraitFitOf(character, 'bust', 'smile')).toEqual({ scale: 2, x: -100, y: -100 });
  });

  it('sizes the picture with the wheel and writes it once the wheel rests', () => {
    vi.useFakeTimers();
    try {
      const character = makeCharacter('勇者', ['smile']);
      component.character.set(character);
      fixture.detectChanges();
      const wheel = { deltaY: -100, deltaMode: 0, clientX: 0, clientY: 0, preventDefault: vi.fn() };

      api().onWheel(wheel as unknown as WheelEvent);
      api().onWheel(wheel as unknown as WheelEvent);

      const shown = component.fit().scale;
      expect(wheel.preventDefault).toHaveBeenCalled();
      expect(shown).toBeGreaterThan(1.4);
      expect(character.portraitFits).toBe('');

      vi.advanceTimersByTime(1000);
      expect(scaleOf(character, 'smile')).toBe(shown);
    } finally {
      vi.useRealTimers();
    }
  });

  it('moves and sizes the picture from the keyboard', () => {
    const character = makeCharacter('勇者', ['smile']);
    component.character.set(character);
    fixture.detectChanges();
    const key = (name: string) => ({ key: name, shiftKey: false, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

    api().onKeyDown(key('ArrowRight'));
    api().onKeyDown(key('ArrowUp'));
    api().onKeyDown(key('+'));

    expect(portraitFitOf(character, 'bust', 'smile')).toEqual({ scale: 1.1, x: 4.4, y: -4.4 });
  });

  it('shows a kept fit it cannot make sense of as the default, and replaces it once changed', () => {
    const character = makeCharacter('勇者', ['smile']);
    character.portraitFits = '{"bust":{"smile":{"x":"left"}}}';
    component.character.set(character);
    fixture.detectChanges();

    expect(component.fit()).toEqual(DEFAULT_CUT_IN_PORTRAIT_FIT);

    api().onKeyDown({ key: 'ArrowDown', shiftKey: false, preventDefault: vi.fn() } as never);
    expect(JSON.parse(character.portraitFits)).toEqual({ bust: { smile: { scale: 1, x: 0, y: 4 } } });
  });

  it('puts the picture back the way an unfitted one sits', async () => {
    const character = makeCharacter('勇者', ['smile']);
    setPortraitFitOf(character, 'bust', 'smile', { scale: 2, x: 10, y: 10 });
    component.character.set(character);
    fixture.detectChanges();

    (query('portrait-fit-reset') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(portraitFitOf(character, 'bust', 'smile')).toBeNull();
    expect(component.fit()).toEqual(DEFAULT_CUT_IN_PORTRAIT_FIT);
  });

  it('keeps two characters that share a picture apart', () => {
    const hero = makeCharacter('勇者', ['shared']);
    const rival = makeCharacter('宿敵', ['shared']);
    setPortraitFitOf(rival, 'bust', 'shared', { scale: 3, x: 90, y: 90 });
    component.character.set(hero);
    fixture.detectChanges();

    api().zoomIn();

    expect(portraitFitOf(rival, 'bust', 'shared')).toEqual({ scale: 3, x: 90, y: 90 });
    expect(scaleOf(hero, 'shared')).toBeCloseTo(1.1);
  });

  it('shows the fit but changes nothing for a user who may not change the table', () => {
    canEditTabletop = false;
    const character = makeCharacter('勇者', ['smile']);
    component.character.set(character);
    fixture.detectChanges();

    api().onPointerDown(pointer('pointerdown', 1, 100, 100));
    api().onPointerMove(pointer('pointermove', 1, 160, 100));
    api().onPointerUp(pointer('pointerup', 1, 160, 100));
    api().zoomIn();
    api().onWheel({ deltaY: -100, preventDefault: vi.fn() } as never);
    api().onKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() } as never);

    expect(character.portraitFits).toBe('');
    expect(query('portrait-fit-read-only')).not.toBeNull();
    expect((query('portrait-fit-zoom-in') as HTMLButtonElement).disabled).toBe(true);
  });
});
