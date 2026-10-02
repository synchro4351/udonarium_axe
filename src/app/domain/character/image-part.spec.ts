import { imagePartBetween, imagePartPlacement, imagePointAt, validImageParts } from '@axe/domain/character/image-part';

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
  it('keeps relative centres and sizes for independent square tokens', () => {
    expect(imagePartPlacement(part, 100, 100, 50)).toEqual({ x: -20, y: -60, size: 1.6 });
  });
});
