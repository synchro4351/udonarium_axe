import {
  BACKGROUND_COLOR_DISTANCE,
  canClearBackground,
  clearColor,
  colorAt,
  pixelUnderPoint,
  transparentFileName,
} from '@axe/features/file/file-storage/transparent-background';

function pixels(...rgba: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(rgba.flat());
}

function alphas(data: Uint8ClampedArray): number[] {
  return Array.from(data.filter((_, index) => index % 4 === 3));
}

describe('making a background transparent', () => {
  describe('colorAt', () => {
    it('reads the colour of the pixel at a point, row by row', () => {
      const data = pixels([1, 2, 3, 255], [4, 5, 6, 255], [7, 8, 9, 255], [10, 11, 12, 255]);

      expect(colorAt(data, 2, 1, 0)).toEqual({ r: 4, g: 5, b: 6 });
      expect(colorAt(data, 2, 0, 1)).toEqual({ r: 7, g: 8, b: 9 });
    });
  });

  describe('clearColor', () => {
    it('clears the picked colour and the colours close to it', () => {
      const data = pixels([255, 255, 255, 255], [240, 250, 245, 255], [0, 0, 0, 255]);

      const cleared = clearColor(data, { r: 255, g: 255, b: 255 });

      expect(cleared).toBe(2);
      expect(alphas(data)).toEqual([0, 0, 255]);
    });

    it('leaves a colour just beyond the fixed distance alone', () => {
      const edge = 255 - BACKGROUND_COLOR_DISTANCE;
      const data = pixels([edge, 255, 255, 255], [edge - 1, 255, 255, 255]);

      clearColor(data, { r: 255, g: 255, b: 255 });

      expect(alphas(data)).toEqual([0, 255]);
    });

    it('keeps the colour and the own transparency of every pixel it does not clear', () => {
      const data = pixels([10, 200, 30, 128], [0, 255, 0, 255]);

      clearColor(data, { r: 0, g: 255, b: 0 });

      expect(Array.from(data)).toEqual([10, 200, 30, 128, 0, 255, 0, 0]);
    });

    it('does not count pixels that were already transparent', () => {
      const data = pixels([0, 0, 0, 0], [0, 0, 0, 255]);

      expect(clearColor(data, { r: 0, g: 0, b: 0 })).toBe(1);
    });
  });

  describe('pixelUnderPoint', () => {
    const box = { width: 200, height: 100 };

    it('finds the pixel under a point of a picture scaled to fit the box', () => {
      // A 100x100 picture is shown 100 px square, centred with 50 px either side.
      const picture = { width: 100, height: 100 };

      expect(pixelUnderPoint({ x: 50, y: 0 }, box, picture)).toEqual({ x: 0, y: 0 });
      expect(pixelUnderPoint({ x: 149.5, y: 99.5 }, box, picture)).toEqual({ x: 99, y: 99 });
    });

    it('scales a large picture down to the box', () => {
      const picture = { width: 800, height: 400 };

      expect(pixelUnderPoint({ x: 100, y: 50 }, box, picture)).toEqual({ x: 400, y: 200 });
    });

    it('finds no pixel on the empty margin beside the picture', () => {
      const picture = { width: 100, height: 100 };

      expect(pixelUnderPoint({ x: 49, y: 50 }, box, picture)).toBeNull();
      expect(pixelUnderPoint({ x: 150, y: 50 }, box, picture)).toBeNull();
    });

    it('finds nothing in a box or picture with no size', () => {
      expect(pixelUnderPoint({ x: 0, y: 0 }, { width: 0, height: 0 }, { width: 10, height: 10 })).toBeNull();
      expect(pixelUnderPoint({ x: 0, y: 0 }, box, { width: 0, height: 10 })).toBeNull();
    });
  });

  describe('canClearBackground', () => {
    it('allows a still picture', async () => {
      const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], 'a.png', {
        type: 'image/png',
      });

      expect(await canClearBackground(png)).toBe(true);
    });

    it('refuses a moving picture, which would come back as its first frame', async () => {
      const gif = new File([new TextEncoder().encode('GIF89a......')], 'a.gif', { type: 'image/gif' });

      expect(await canClearBackground(gif)).toBe(false);
    });
  });

  describe('transparentFileName', () => {
    it('marks the copy and gives it the extension of its format', () => {
      expect(transparentFileName('goblin.jpg', 'image/webp')).toBe('goblin-transparent.webp');
      expect(transparentFileName('goblin.jpg', 'image/png')).toBe('goblin-transparent.png');
    });

    it('keeps a save-data name from carrying the original identifier over', () => {
      const hash = 'a'.repeat(64);

      expect(transparentFileName(`${hash}.png`, 'image/webp')).not.toMatch(/^[0-9a-f]{64}\./);
    });

    it('names a copy of an unnamed picture', () => {
      expect(transparentFileName('', 'image/png')).toBe('image-transparent.png');
    });
  });
});
