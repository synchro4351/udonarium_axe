import {
  imagePartBetween,
  imagePartPlacement,
  imagePointAt,
  imagePointInsideAnyPart,
  imageRegionsOverlap,
  overlapsAnyImagePart,
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
  it('treats only positive-area intersections as overlap', () => {
    const base = { x: 20, y: 20, width: 40, height: 40 };
    expect(imageRegionsOverlap(base, { x: 30, y: 30, width: 10, height: 10 })).toBe(true);
    expect(imageRegionsOverlap(base, { x: 10, y: 10, width: 80, height: 80 })).toBe(true);
    expect(imageRegionsOverlap(base, { x: 50, y: 50, width: 40, height: 40 })).toBe(true);
    expect(imageRegionsOverlap(base, { ...base })).toBe(true);
    expect(imageRegionsOverlap(base, { x: 60, y: 20, width: 10, height: 40 })).toBe(false);
    expect(imageRegionsOverlap(base, { x: 20, y: 60, width: 40, height: 10 })).toBe(false);
    expect(imageRegionsOverlap(base, { x: 60, y: 60, width: 10, height: 10 })).toBe(false);
    expect(overlapsAnyImagePart(base, [{ x: 0, y: 0, width: 5, height: 5 }, base])).toBe(true);
  });
  it('lets a selection start on an edge but not inside a region', () => {
    const parts = [{ x: 20, y: 20, width: 40, height: 40 }];
    expect(imagePointInsideAnyPart({ x: 30, y: 30 }, parts)).toBe(true);
    expect(imagePointInsideAnyPart({ x: 20, y: 30 }, parts)).toBe(false);
    expect(imagePointInsideAnyPart({ x: 60, y: 60 }, parts)).toBe(false);
  });
  it('rejects overlapping parts but accepts edge-touching ones', () => {
    const next = { name: 'Next', x: 60, y: 10, width: 20, height: 20 };
    expect(validImageParts([part, next], 100, 100)).toBe(true);
    expect(validImageParts([part, { ...next, x: 59 }], 100, 100)).toBe(false);
    expect(validImageParts([part, { ...part, name: 'Copy' }], 100, 100)).toBe(false);
    expect(validImageParts([part, { ...next, x: 25, y: 15, width: 5, height: 5 }], 100, 100)).toBe(false);
  });
  it('keeps relative centres and sizes for independent square tokens', () => {
    expect(imagePartPlacement(part, 100, 100, 50)).toEqual({ x: -20, y: -60, size: 1.6 });
  });
});
