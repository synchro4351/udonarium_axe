import { dockBoxes, dockEdgeAt, dockPlacement, dockPreviewBox } from '@axe/application/ui/panel-dock-helpers';
import { describe, expect, it } from 'vitest';

const viewport = { width: 1000, height: 800 };

describe('panel dock helpers', () => {
  it('finds the side the pointer is pressed against', () => {
    expect(dockEdgeAt(10, 1000)).toBe('left');
    expect(dockEdgeAt(995, 1000)).toBe('right');
    expect(dockEdgeAt(500, 1000)).toBeNull();
  });

  it('gives one docked panel the full height, keeping its width', () => {
    expect(dockBoxes('left', [300], viewport)).toEqual([{ left: 0, top: 0, width: 300, height: 800 }]);
    expect(dockBoxes('right', [300], viewport)).toEqual([{ left: 700, top: 0, width: 300, height: 800 }]);
  });

  it('splits the height between two, and gives the last the pixel left over', () => {
    expect(dockBoxes('right', [300, 200], { width: 1000, height: 801 })).toEqual([
      { left: 700, top: 0, width: 300, height: 400 },
      { left: 800, top: 400, width: 200, height: 401 },
    ]);
  });

  it('pulls a panel wider than the screen in', () => {
    expect(dockBoxes('left', [1200], viewport)[0].width).toBe(1000);
  });

  it('splits a docked panel over its top or bottom third, joins it over the middle, and only joins on a full side', () => {
    expect(dockPlacement(0, 700, 800)).toEqual({ kind: 'slot', index: 0 });
    expect(dockPlacement(1, 400, 800)).toEqual({ kind: 'tab', index: 0 });
    expect(dockPlacement(1, 100, 800)).toEqual({ kind: 'slot', index: 0 });
    expect(dockPlacement(1, 700, 800)).toEqual({ kind: 'slot', index: 1 });
    expect(dockPlacement(2, 100, 800)).toEqual({ kind: 'tab', index: 0 });
    expect(dockPlacement(2, 700, 800)).toEqual({ kind: 'tab', index: 1 });
  });

  it('previews the place a panel would take, or the docked panel it would join', () => {
    expect(dockPreviewBox('left', [300], 250, 700, viewport)).toEqual({ left: 0, top: 400, width: 250, height: 400 });
    expect(dockPreviewBox('left', [300], 250, 400, viewport)).toEqual({ left: 0, top: 0, width: 300, height: 800 });
    expect(dockPreviewBox('left', [300, 200], 250, 700, viewport)).toEqual({
      left: 0,
      top: 400,
      width: 200,
      height: 400,
    });
  });
});
