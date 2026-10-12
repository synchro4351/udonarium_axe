import {
  imagePartBetween,
  imagePartPlacement,
  imagePointAt,
  moveImagePart,
  resizeImagePart,
  topmostImagePartAt,
  validImageParts,
} from '@axe/domain/character/image-part';

describe('image part selection', () => {
  const part = { name: 'Head', x: 20, y: 10, width: 40, height: 20 };
  it('maps a scaled display to source pixels and clamps an outside pointer', () => {
    const bounds = { left: 10, top: 20, width: 100, height: 50 };
    expect(imagePointAt({ x: 60, y: 45 }, bounds, 400, 200)).toEqual({ x: 200, y: 100 });
    expect(imagePointAt({ x: -20, y: 200 }, bounds, 400, 200)).toEqual({ x: 0, y: 200 });
  });
  it('supports reverse dragging without reversing the resulting coordinates', () => {
    expect(imagePartBetween({ x: 60, y: 30 }, { x: 20, y: 10 }, 'Head')).toEqual(part);
  });
  it('rejects empty, oversized, invalid, unnamed and out-of-bounds selections', () => {
    expect(validImageParts([part], 100, 100)).toBe(true);
    for (const invalid of [
      [],
      Array.from({ length: 21 }, () => part),
      [{ ...part, name: ' ' }],
      [{ ...part, x: -1 }],
      [{ ...part, width: 1 }],
      [{ ...part, y: NaN }],
      [{ ...part, width: 200 }],
    ]) {
      expect(validImageParts(invalid, 100, 100)).toBe(false);
    }
  });
  it('picks the topmost region under a point and ignores edges', () => {
    const parts = [
      { x: 20, y: 20, width: 40, height: 40 },
      { x: 40, y: 40, width: 40, height: 40 },
    ];
    expect(topmostImagePartAt({ x: 30, y: 30 }, parts)).toBe(0);
    expect(topmostImagePartAt({ x: 50, y: 50 }, parts)).toBe(1);
    expect(topmostImagePartAt({ x: 20, y: 30 }, parts)).toBe(-1);
    expect(topmostImagePartAt({ x: 90, y: 90 }, parts)).toBe(-1);
  });
  it('accepts overlapping, nested and identical parts', () => {
    const next = { name: 'Next', x: 50, y: 10, width: 20, height: 20 };
    expect(validImageParts([part, next], 100, 100)).toBe(true);
    expect(validImageParts([part, { ...part, name: 'Copy' }], 100, 100)).toBe(true);
    expect(validImageParts([part, { ...next, x: 25, y: 15, width: 5, height: 5 }], 100, 100)).toBe(true);
  });
  it('moves a region without changing its size and keeps it inside the image', () => {
    expect(moveImagePart(part, 10, 5, 100, 100)).toEqual({ ...part, x: 30, y: 15 });
    expect(moveImagePart(part, 500, 500, 100, 100)).toEqual({ ...part, x: 60, y: 80 });
    expect(moveImagePart(part, -500, -500, 100, 100)).toEqual({ ...part, x: 0, y: 0 });
  });
  it('resizes from a corner or an edge with the opposite side fixed', () => {
    expect(resizeImagePart(part, 'se', { x: 80, y: 50 }, 100, 100)).toEqual({ ...part, width: 60, height: 40 });
    expect(resizeImagePart(part, 'nw', { x: 10, y: 0 }, 100, 100)).toEqual({
      ...part,
      x: 10,
      y: 0,
      width: 50,
      height: 30,
    });
    expect(resizeImagePart(part, 'e', { x: 90, y: 99 }, 100, 100)).toEqual({ ...part, width: 70 });
    expect(resizeImagePart(part, 'n', { x: 0, y: 20 }, 100, 100)).toEqual({ ...part, y: 20, height: 10 });
  });
  it('turns a region over when its handle is dragged past the opposite side', () => {
    expect(resizeImagePart(part, 'w', { x: 80, y: 0 }, 100, 100)).toEqual({ ...part, x: 60, width: 20 });
    expect(resizeImagePart(part, 'se', { x: 10, y: 0 }, 100, 100)).toEqual({
      ...part,
      x: 10,
      y: 0,
      width: 10,
      height: 10,
    });
  });
  it('keeps the minimum size and the image bounds while resizing', () => {
    expect(resizeImagePart(part, 'e', { x: 21, y: 0 }, 100, 100)).toEqual({ ...part, width: 2 });
    expect(resizeImagePart(part, 'w', { x: 60, y: 0 }, 100, 100)).toEqual({ ...part, x: 60, width: 2 });
    // At the image edge there is no room beyond the fixed side, so the minimum is taken from the other side.
    expect(resizeImagePart({ ...part, x: 98, width: 2 }, 'w', { x: 100, y: 0 }, 100, 100)).toEqual({
      ...part,
      x: 98,
      width: 2,
    });
    expect(resizeImagePart(part, 'se', { x: 500, y: 500 }, 100, 100)).toEqual({ ...part, width: 80, height: 90 });
  });
  it('keeps relative centres and sizes for independent square tokens', () => {
    expect(imagePartPlacement(part, 100, 100, 50)).toEqual({ x: -20, y: -60, size: 1.6 });
  });
});
