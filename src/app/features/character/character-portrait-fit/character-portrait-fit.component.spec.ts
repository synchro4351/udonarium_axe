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
    zoomIn(): void;
    onZoomInput(event: Event): void;
    onZoomChange(event: Event): void;
    onAxisChange(axis: 'x' | 'y', event: Event): void;
  };

  function api(): Api {
    return component as unknown as Api;
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

    expect(portraitFitOf(character, 'bust', 'angry')?.zoom).toBeGreaterThan(1);
    expect(portraitFitOf(character, 'bust', 'smile')).toBeNull();
    expect(component.savedFit()).toEqual(portraitFitOf(character, 'bust', 'angry'));
  });

  it('follows the character when its fit changes from elsewhere, as another peer changing it would', async () => {
    const character = makeCharacter('勇者', ['smile']);
    component.character.set(character);
    fixture.detectChanges();

    setPortraitFitOf(character, 'bust', 'smile', { zoom: 1.5, x: 20, y: 30 });
    await fixture.whenStable();

    expect(component.fit()).toEqual({ zoom: 1.5, x: 20, y: 30 });
  });

  it('shows a drag as it goes and writes it to the character once, when it ends', async () => {
    const character = makeCharacter('勇者', ['smile']);
    component.character.set(character);
    fixture.detectChanges();

    api().onPointerDown(pointer('pointerdown', 1, 100, 100));
    api().onPointerMove(pointer('pointermove', 1, 140, 100));
    api().onPointerMove(pointer('pointermove', 1, 160, 100));

    expect(component.fit().x).toBeLessThan(50);
    expect(character.portraitFits).toBe('');

    const shown = component.fit();
    api().onPointerUp(pointer('pointerup', 1, 160, 100));
    await fixture.whenStable();

    expect(portraitFitOf(character, 'bust', 'smile')).toEqual(shown);
    expect(component.fit()).toEqual(shown);
  });

  it('sizes the picture with two fingers apart', () => {
    const character = makeCharacter('勇者', ['smile']);
    component.character.set(character);
    fixture.detectChanges();

    api().onPointerDown(pointer('pointerdown', 1, 100, 100));
    api().onPointerDown(pointer('pointerdown', 2, 200, 100));
    api().onPointerMove(pointer('pointermove', 2, 300, 100));
    api().onPointerUp(pointer('pointerup', 2, 300, 100));
    api().onPointerUp(pointer('pointerup', 1, 100, 100));

    expect(portraitFitOf(character, 'bust', 'smile')?.zoom).toBe(2);
  });

  it('sizes the picture with the wheel, the slider and the number fields', () => {
    const character = makeCharacter('勇者', ['smile']);
    component.character.set(character);
    fixture.detectChanges();
    const wheel = { deltaY: -100, preventDefault: vi.fn() } as unknown as WheelEvent;

    api().onWheel(wheel);
    expect(wheel.preventDefault).toHaveBeenCalled();
    expect(portraitFitOf(character, 'bust', 'smile')?.zoom).toBeGreaterThan(1);

    api().onZoomInput({ target: { value: '2.5' } } as never);
    expect(component.fit().zoom).toBe(2.5);
    api().onZoomChange({ target: { value: '2.5' } } as never);
    api().onAxisChange('y', { target: { valueAsNumber: 30 } } as never);

    expect(portraitFitOf(character, 'bust', 'smile')).toMatchObject({ zoom: 2.5, y: 30 });
  });

  it('puts the picture back the way an unfitted one sits', async () => {
    const character = makeCharacter('勇者', ['smile']);
    setPortraitFitOf(character, 'bust', 'smile', { zoom: 2, x: 10, y: 10 });
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
    setPortraitFitOf(rival, 'bust', 'shared', { zoom: 3, x: 90, y: 90 });
    component.character.set(hero);
    fixture.detectChanges();

    api().zoomIn();

    expect(portraitFitOf(rival, 'bust', 'shared')).toEqual({ zoom: 3, x: 90, y: 90 });
    expect(portraitFitOf(hero, 'bust', 'shared')?.zoom).toBeCloseTo(1.08);
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

    expect(character.portraitFits).toBe('');
    expect(query('portrait-fit-read-only')).not.toBeNull();
    expect((query('portrait-fit-zoom') as HTMLInputElement).disabled).toBe(true);
  });
});
