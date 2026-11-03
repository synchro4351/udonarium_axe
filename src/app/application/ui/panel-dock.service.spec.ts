import { TestBed } from '@angular/core/testing';
import { PanelHandoff } from '@axe/application/ui/panel.service';
import { PanelDockFrame, PanelDockService } from '@axe/application/ui/panel-dock.service';
import { DockBox } from '@axe/application/ui/panel-dock-helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeFrame extends PanelDockFrame {
  box: DockBox | null;
  taken: PanelHandoff[];
  dismissed: boolean;
}

let frames = 0;

function frame(width = 300, inDocument: Document = document): FakeFrame {
  const fake: FakeFrame = {
    frameKey: `frame-${(frames += 1)}`,
    box: null,
    taken: [],
    dismissed: false,
    applyDock: (box) => {
      fake.box = box;
    },
    frameSize: () => ({ width: fake.box?.width ?? width, height: 200 }),
    framePlace: () => ({ left: 0, top: 0 }),
    frameDocument: () => inDocument,
    handOverAll: () => [{ panel: { title: fake.frameKey } } as unknown as PanelHandoff],
    takeIn: (handoff) => fake.taken.push(handoff),
    dismissFrame: () => {
      fake.dismissed = true;
    },
    openTab: vi.fn(),
    setInitialRotation: vi.fn(),
    claimSelf: vi.fn(),
    closeTab: vi.fn(),
    panelCount: () => 1,
  };
  return fake;
}

describe('PanelDockService', () => {
  let service: PanelDockService;

  beforeEach(() => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    service = TestBed.inject(PanelDockService);
  });

  afterEach(() => vi.restoreAllMocks());

  function dock(target: FakeFrame, x: number, y: number): boolean {
    service.hover(target, x, y);
    return service.drop(target);
  }

  it('docks a panel let go of at a side to the full height, and shows where first', () => {
    const one = frame(300);

    service.hover(one, 5, 300);
    expect(service.preview()).toEqual({ left: 0, top: 0, width: 300, height: 800 });
    expect(service.drop(one)).toBe(true);

    expect(one.box).toEqual({ left: 0, top: 0, width: 300, height: 800 });
    expect(service.edgeOf(one)).toBe('left');
    expect(service.preview()).toBeNull();
  });

  it('leaves a panel let go of away from the sides where it is', () => {
    const one = frame();

    service.hover(one, 500, 300);
    expect(service.preview()).toBeNull();
    expect(service.drop(one)).toBe(false);
    expect(one.box).toBeNull();
  });

  it('stacks a second panel above or below, and folds a third into the nearer one as a tab', () => {
    const first = frame(300);
    const second = frame(200);
    const third = frame(250);
    dock(first, 995, 100);
    dock(second, 995, 100);

    expect(second.box).toEqual({ left: 800, top: 0, width: 200, height: 400 });
    expect(first.box).toEqual({ left: 700, top: 400, width: 300, height: 400 });

    expect(dock(third, 995, 700)).toBe(true);
    expect(first.taken).toHaveLength(1);
    expect(third.dismissed).toBe(true);
    expect(service.edgeOf(third)).toBeNull();
  });

  it('closes up the side when a docked panel is picked up or taken down', () => {
    const first = frame(300);
    const second = frame(300);
    dock(first, 5, 100);
    dock(second, 5, 700);

    service.undock(first);
    expect(first.box).toBeNull();
    expect(second.box).toEqual({ left: 0, top: 0, width: 300, height: 800 });

    service.forget(second);
    expect(service.edgeOf(second)).toBeNull();
  });

  it('does not dock a panel in a window of its own', () => {
    const other = document.implementation.createHTMLDocument('popped out');
    const popped = frame(300, other);

    service.hover(popped, 5, 300);
    expect(service.preview()).toBeNull();
    expect(service.drop(popped)).toBe(false);
  });

  it('puts the docked panels back in place when the screen changes size', () => {
    const one = frame(300);
    dock(one, 995, 300);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200);

    window.dispatchEvent(new Event('resize'));
    expect(one.box).toEqual({ left: 900, top: 0, width: 300, height: 800 });
  });
});
