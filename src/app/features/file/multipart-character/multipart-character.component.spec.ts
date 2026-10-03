import { TestBed } from '@angular/core/testing';
import { MultipartCharacterService } from '@axe/application/tabletop/multipart-character.service';
import { PanelService } from '@axe/application/ui/panel.service';
import { MultipartCharacterComponent } from '@axe/features/file/multipart-character/multipart-character.component';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('MultipartCharacterComponent', () => {
  const service = { mayUse: () => true, create: vi.fn() };
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MultipartCharacterComponent], providers: [...TEST_PROVIDERS] });
    TestBed.overrideProvider(MultipartCharacterService, { useValue: service });
    TestBed.overrideProvider(PanelService, { useValue: { close: vi.fn() } });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    service.create.mockReset();
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

  describe('non-overlapping selection', () => {
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
      const drag = (from: [number, number], to: [number, number]) => {
        component.pointerDown(event(...from));
        component.pointerMove(event(...to));
        component.pointerUp(event(...to));
      };
      return { fixture, component, drag };
    };

    it('rejects overlapping forward and reverse drags and reports it', () => {
      const { fixture, component, drag } = setup();
      drag([10, 10], [50, 50]);
      expect(component.parts()).toHaveLength(1);
      drag([60, 60], [30, 30]);
      expect(component.parts()).toHaveLength(1);
      expect(component.error()).toBe('feature.file.multipart.overlap');
      drag([150, 90], [30, 30]);
      expect(component.parts()).toHaveLength(1);
      drag([0, 60], [100, 0]);
      expect(component.parts()).toHaveLength(1);
      fixture.destroy();
    });

    it('does not begin a selection inside an existing region and clears stale errors on a valid one', () => {
      const { fixture, component, drag } = setup();
      drag([10, 10], [50, 50]);
      drag([20, 20], [90, 90]);
      expect(component['pointer']).toBeNull();
      expect(component.parts()).toHaveLength(1);
      drag([60, 60], [30, 30]);
      expect(component.error()).not.toBe('');
      drag([60, 10], [90, 40]);
      expect(component.error()).toBe('');
      expect(component.parts()).toHaveLength(2);
      fixture.destroy();
    });

    it('allows edge-touching regions and reuses a freed region after deletion', () => {
      const { fixture, component, drag } = setup();
      drag([10, 10], [50, 50]);
      drag([50, 10], [90, 50]);
      expect(component.parts()).toHaveLength(2);
      expect(component.parts()[1]).toMatchObject({ x: 100 });
      drag([20, 20], [40, 40]);
      expect(component.parts()).toHaveLength(2);
      component.remove(0);
      drag([20, 20], [40, 40]);
      expect(component.parts()).toHaveLength(2);
      expect(component.parts()[1]).toMatchObject({ x: 40, y: 40, width: 40, height: 40 });
      fixture.destroy();
    });

    it('marks an overlapping draft as blocked', () => {
      const { fixture, component } = setup();
      component.parts.set([{ name: 'A', x: 0, y: 0, width: 100, height: 100 }]);
      component.draft.set({ name: '', x: 50, y: 50, width: 100, height: 100 });
      expect(component.draftBlocked()).toBe(true);
      component.draft.set({ name: '', x: 100, y: 0, width: 50, height: 50 });
      expect(component.draftBlocked()).toBe(false);
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
