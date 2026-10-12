import { TestBed } from '@angular/core/testing';
import { MultipartCharacterService } from '@axe/application/tabletop/multipart-character.service';
import { PanelService } from '@axe/application/ui/panel.service';
import { GameCharacter } from '@axe/domain/character/game-character';
import { MultipartCharacterComponent } from '@axe/features/file/multipart-character/multipart-character.component';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('MultipartCharacterComponent', () => {
  const service = { mayUse: () => true, mayLink: () => true, create: vi.fn(), createLinked: vi.fn() };
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MultipartCharacterComponent], providers: [...TEST_PROVIDERS] });
    TestBed.overrideProvider(MultipartCharacterService, { useValue: service });
    TestBed.overrideProvider(PanelService, { useValue: { close: vi.fn() } });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    service.create.mockReset();
    service.createLinked.mockReset();
  });

  it('maps touch pointer coordinates, names a reverse-drag selection and removes it', () => {
    const fixture = TestBed.createComponent(MultipartCharacterComponent);
    const component = fixture.componentInstance;
    component['image'] = {} as HTMLImageElement;
    component.width.set(400);
    component.height.set(200);
    const target = {
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }),
      setPointerCapture: vi.fn(),
    };
    const event = (x: number, y: number) =>
      ({
        button: 0,
        pointerId: 2,
        pointerType: 'touch',
        clientX: x,
        clientY: y,
        currentTarget: target,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }) as unknown as PointerEvent;
    component.pointerDown(event(160, 100));
    component.pointerMove(event(60, 40));
    component.pointerUp(event(60, 40));
    expect(component.parts()[0]).toMatchObject({ x: 100, y: 40, width: 200, height: 120 });
    component.rename(0, 'Arm');
    expect(component.parts()[0].name).toBe('Arm');
    component.remove(0);
    expect(component.parts()).toHaveLength(0);
    fixture.destroy();
  });

  describe('region selection, overlap, move and resize', () => {
    // 400x200 source shown at 200x100 from (0,0): one display pixel is two source pixels.
    const setup = () => {
      const fixture = TestBed.createComponent(MultipartCharacterComponent);
      const component = fixture.componentInstance;
      component['image'] = {} as HTMLImageElement;
      component.width.set(400);
      component.height.set(200);
      const target = {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
        setPointerCapture: vi.fn(),
      };
      const event = (x: number, y: number) =>
        ({
          button: 0,
          pointerId: 1,
          clientX: x,
          clientY: y,
          currentTarget: target,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        }) as unknown as PointerEvent;
      const handleTarget = { closest: () => target, parentElement: target, setPointerCapture: vi.fn() };
      const handleEvent = (x: number, y: number) =>
        ({ ...event(x, y), currentTarget: handleTarget }) as unknown as PointerEvent;
      const drag = (from: [number, number], to: [number, number]) => {
        component.pointerDown(event(...from));
        component.pointerMove(event(...to));
        component.pointerUp(event(...to));
      };
      return { fixture, component, drag, event, handleEvent };
    };

    it('accepts overlapping forward and reverse drags, started inside or outside an existing region', () => {
      const { fixture, component, drag } = setup();
      drag([10, 10], [50, 50]);
      component.select(null);
      drag([60, 60], [30, 30]);
      component.select(null);
      drag([150, 90], [30, 30]);
      component.select(null);
      drag([20, 20], [40, 40]);
      expect(component.parts()).toHaveLength(4);
      expect(component.error()).toBe('');
      fixture.destroy();
    });

    it('selects a clicked region, deselects on empty space and creates nothing from a click', () => {
      const { fixture, component, drag } = setup();
      drag([10, 10], [50, 50]);
      drag([60, 10], [90, 40]);
      expect(component.selected()).toBe(1);
      drag([20, 20], [21, 21]);
      expect(component.selected()).toBe(0);
      expect(component.parts()).toHaveLength(2);
      drag([20, 80], [20, 80]);
      expect(component.selected()).toBeNull();
      expect(component.parts()).toHaveLength(2);
      fixture.destroy();
    });

    it('selects the topmost region where regions overlap', () => {
      const { fixture, component, drag } = setup();
      drag([10, 10], [60, 60]);
      component.select(null);
      drag([40, 40], [90, 90]);
      component.select(null);
      drag([50, 50], [50, 50]);
      expect(component.selected()).toBe(1);
      fixture.destroy();
    });

    it('moves the selected region with the pointer and keeps it inside the image', () => {
      const { fixture, component, drag } = setup();
      drag([10, 10], [50, 50]);
      expect(component.parts()[0]).toMatchObject({ x: 20, y: 20, width: 80, height: 80 });
      drag([30, 30], [40, 35]);
      expect(component.parts()[0]).toMatchObject({ x: 40, y: 30, width: 80, height: 80 });
      drag([40, 40], [500, 500]);
      expect(component.parts()[0]).toMatchObject({ x: 320, y: 120, width: 80, height: 80 });
      expect(component.parts()).toHaveLength(1);
      fixture.destroy();
    });

    it('restores a move that is cancelled', () => {
      const { fixture, component, event } = setup();
      component.parts.set([{ name: 'A', x: 20, y: 20, width: 80, height: 80 }]);
      component.select(0);
      component.pointerDown(event(30, 30));
      component.pointerMove(event(60, 60));
      expect(component.parts()[0]).toMatchObject({ x: 80, y: 80 });
      component.cancelPointer();
      expect(component.parts()[0]).toMatchObject({ x: 20, y: 20 });
      fixture.destroy();
    });

    it('resizes from a handle, including past the opposite side, without creating a region', () => {
      const { fixture, component, handleEvent } = setup();
      component.parts.set([{ name: 'A', x: 20, y: 20, width: 80, height: 80 }]);
      component.select(0);
      component.handleDown(handleEvent(50, 50), 'se');
      component.pointerMove(handleEvent(70, 60));
      component.pointerUp(handleEvent(70, 60));
      expect(component.parts()).toEqual([{ name: 'A', x: 20, y: 20, width: 120, height: 100 }]);
      component.handleDown(handleEvent(70, 60), 'w');
      component.pointerMove(handleEvent(100, 60));
      component.pointerUp(handleEvent(100, 60));
      expect(component.parts()[0]).toMatchObject({ x: 140, width: 60, y: 20, height: 100 });
      expect(component.parts()).toHaveLength(1);
      fixture.destroy();
    });

    it('ignores a handle press while nothing is selected or editing is not allowed', () => {
      const { fixture, component, handleEvent } = setup();
      component.parts.set([{ name: 'A', x: 20, y: 20, width: 80, height: 80 }]);
      component.handleDown(handleEvent(50, 50), 'se');
      expect(component['pointer']).toBeNull();
      component.select(0);
      vi.spyOn(service, 'mayUse').mockReturnValue(false);
      component.handleDown(handleEvent(50, 50), 'se');
      expect(component['pointer']).toBeNull();
      fixture.destroy();
    });

    it('keeps the selection on the same region when an earlier one is removed', () => {
      const { fixture, component, drag } = setup();
      drag([10, 10], [30, 30]);
      drag([60, 10], [90, 40]);
      expect(component.selected()).toBe(1);
      component.remove(0);
      expect(component.selected()).toBe(0);
      component.remove(0);
      expect(component.selected()).toBeNull();
      fixture.destroy();
    });
  });

  describe('splitting a character', () => {
    const character = { identifier: 'dragon', name: 'Dragon', imageFile: { identifier: 'img' } } as GameCharacter;
    const setup = () => {
      const fixture = TestBed.createComponent(MultipartCharacterComponent);
      const component = fixture.componentInstance;
      component.character.set(character);
      component.groupName.set('Dragon');
      component['identifier'] = 'img';
      component['image'] = {} as HTMLImageElement;
      return { fixture, component };
    };
    const part = (x: number) => ({ name: `P${x}`, x, y: 0, width: 10, height: 10 });

    it('needs two parts and a creature name before it splits, then passes them on', async () => {
      const { fixture, component } = setup();
      component.parts.set([part(0)]);
      expect(component.canCreate).toBe(false);
      await component.create();
      expect(service.createLinked).not.toHaveBeenCalled();
      component.parts.set([part(0), part(10)]);
      component.groupName.set(' ');
      expect(component.canCreate).toBe(false);
      component.groupName.set('Wyrm');
      expect(component.canCreate).toBe(true);
      await component.create();
      expect(service.createLinked).toHaveBeenCalledWith(
        character,
        component['image'],
        [part(0), part(10)],
        'Wyrm',
        expect.any(Function)
      );
      expect(service.create).not.toHaveBeenCalled();
      fixture.destroy();
    });

    it('checks the character rather than the bare image, and stops when it may not be split', async () => {
      const { fixture, component } = setup();
      component.parts.set([part(0), part(10)]);
      vi.spyOn(service, 'mayLink').mockReturnValue(false);
      expect(component.canEdit).toBe(false);
      await component.create();
      expect(service.createLinked).not.toHaveBeenCalled();
      fixture.destroy();
    });
  });

  it('does not accept selection or creation when editing is prohibited', async () => {
    const fixture = TestBed.createComponent(MultipartCharacterComponent);
    const component = fixture.componentInstance;
    component['image'] = {} as HTMLImageElement;
    vi.spyOn(service, 'mayUse').mockReturnValue(false);
    const event = { button: 0, pointerId: 1 } as PointerEvent;
    component.pointerDown(event);
    expect(component['pointer']).toBeNull();
    await component.create();
    expect(service.create).not.toHaveBeenCalled();
    fixture.destroy();
  });
});
