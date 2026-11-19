import {
  convertBlobToWebP,
  downscaleImageBlob,
  isAnimatedPng,
  shrinkImageToBytes,
  squareCropOf,
} from '@axe/core/storage/image-downscale';

describe('downscaleImageBlob', () => {
  it('returns nothing for no bytes', async () => {
    expect(await downscaleImageBlob(null, 80)).toBeNull();
  });

  it('returns nothing for nothing at all', async () => {
    expect(await downscaleImageBlob(undefined, 80)).toBeNull();
  });

  it('returns the bytes unchanged for a size of zero or less', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    expect(await downscaleImageBlob(blob, 0)).toBe(blob);
    expect(await downscaleImageBlob(blob, -1)).toBe(blob);
  });

  it('returns anything that is not an image unchanged, since it would never reach the load event', async () => {
    const blob = new Blob(['plain text'], { type: 'text/plain' });
    expect(await downscaleImageBlob(blob, 80)).toBe(blob);
  });

  it('still tries an image with no type, which never happens outside a test', async () => {
    const blob = new Blob(['raw']);
    expect(blob.type).toBe('');
    // Image events never arrive under happy-dom, so the wait always runs to the limit.
    // The usual three seconds would crowd the test timeout and fail only under load.
    const result = await downscaleImageBlob(blob, 80, { loadTimeoutMs: 20 });
    expect(result).toBeDefined();
  });
});

describe('squareCropOf', () => {
  it('takes a tall portrait from the top, where the face is', () => {
    expect(squareCropOf(400, 1200)).toEqual({ sx: 0, sy: 0, side: 400 });
  });

  it('takes a wide image from the middle across', () => {
    expect(squareCropOf(1200, 400)).toEqual({ sx: 400, sy: 0, side: 400 });
  });

  it('leaves a square as it is', () => {
    expect(squareCropOf(256, 256)).toEqual({ sx: 0, sy: 0, side: 256 });
  });
});

describe('convertBlobToWebP', () => {
  it('returns an animated gif unchanged', async () => {
    const blob = new Blob(['GIF89a'], { type: 'image/gif' });
    expect(await convertBlobToWebP(blob)).toBe(blob);
  });

  it('returns an animated png unchanged', async () => {
    const blob = new Blob(['x'], { type: 'image/apng' });
    expect(await convertBlobToWebP(blob)).toBe(blob);
  });

  it('returns a webp unchanged', async () => {
    const blob = new Blob(['x'], { type: 'image/webp' });
    expect(await convertBlobToWebP(blob)).toBe(blob);
  });

  it('returns an svg unchanged', async () => {
    const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    expect(await convertBlobToWebP(blob)).toBe(blob);
  });

  it('returns anything that is not an image unchanged', async () => {
    const blob = new Blob(['text'], { type: 'text/plain' });
    expect(await convertBlobToWebP(blob)).toBe(blob);
  });

  it('returns empty bytes unchanged', async () => {
    const blob = new Blob([], { type: 'image/png' });
    expect(await convertBlobToWebP(blob)).toBe(blob);
  });
});

describe('isAnimatedPng', () => {
  function buildPngChunks(...chunkTypes: string[]): ArrayBuffer {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const parts: number[] = [...signature];
    for (const type of chunkTypes) {
      // length = 0 (empty data)
      parts.push(0, 0, 0, 0);
      // chunk type (4 ASCII chars)
      for (let i = 0; i < 4; i++) parts.push(type.charCodeAt(i));
      // CRC (dummy 4 bytes)
      parts.push(0, 0, 0, 0);
    }
    return new Uint8Array(parts).buffer;
  }

  it('reports animation when the control chunk comes before the data', () => {
    const buffer = buildPngChunks('IHDR', 'acTL', 'IDAT');
    expect(isAnimatedPng(buffer)).toBe(true);
  });

  it('reports none for an ordinary png', () => {
    const buffer = buildPngChunks('IHDR', 'IDAT');
    expect(isAnimatedPng(buffer)).toBe(false);
  });

  it('reports none for a buffer too short to tell', () => {
    expect(isAnimatedPng(new ArrayBuffer(4))).toBe(false);
  });

  it('reports none for an empty buffer', () => {
    expect(isAnimatedPng(new ArrayBuffer(0))).toBe(false);
  });
});

describe('shrinkImageToBytes', () => {
  /** A stand-in for drawing through a canvas: the result weighs in proportion to its area. */
  function resampleBy(weightAt: (scale: number) => number) {
    return vi.fn(async (blob: Blob, scale: number) => new Blob([new Uint8Array(weightAt(scale))], { type: blob.type }));
  }

  it('hands back a picture already within the limit as it is', async () => {
    const blob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' });
    const resample = resampleBy(() => 0);

    expect(await shrinkImageToBytes(blob, 200, resample)).toBe(blob);
    expect(resample).not.toHaveBeenCalled();
  });

  it('scales a heavy picture down in its own format until it fits', async () => {
    const blob = new Blob([new Uint8Array(8000)], { type: 'image/png' });
    const resample = resampleBy((scale) => Math.round(8000 * scale * scale * 1.5));

    const fitted = await shrinkImageToBytes(blob, 2000, resample);

    expect(fitted!.size).toBeLessThanOrEqual(2000);
    expect(fitted!.type).toBe('image/png');
    expect(resample.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('gives up on an animation, a vector, a format a canvas does not write back, or one that never fits', async () => {
    const heavy = (type: string) => new Blob([new Uint8Array(5000)], { type });
    const resample = resampleBy(() => 4000);

    expect(await shrinkImageToBytes(heavy('image/gif'), 1000, resample)).toBeNull();
    expect(await shrinkImageToBytes(heavy('image/svg+xml'), 1000, resample)).toBeNull();
    expect(await shrinkImageToBytes(heavy('image/bmp'), 1000, resample)).toBeNull();
    expect(await shrinkImageToBytes(heavy('image/jpeg'), 1000, resample)).toBeNull();
  });

  it('gives up where the canvas writes another format, keeping the one it came in', async () => {
    const blob = new Blob([new Uint8Array(5000)], { type: 'image/webp' });
    const resample = vi.fn(async () => new Blob([new Uint8Array(10)], { type: 'image/png' }));

    expect(await shrinkImageToBytes(blob, 1000, resample)).toBeNull();
  });
});
