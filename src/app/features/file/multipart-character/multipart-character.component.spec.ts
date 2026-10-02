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
