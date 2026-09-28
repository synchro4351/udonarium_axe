import { isAnimatedImageBytes } from '@axe/core/storage/animated-image';
import { canvasToBlobPreferWebP } from '@axe/core/storage/canvas-blob';

/** A colour taken from a picture with the eyedropper. */
export interface PickedColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * How far from the picked colour a pixel may be and still count as background, as a distance in
 * RGB. It is wide enough to take in the faint noise of a screenshot or a JPEG, and narrow enough
 * to leave a clearly different outline alone.
 */
export const BACKGROUND_COLOR_DISTANCE = 40;

/** The colour of the pixel at (x, y) in RGBA pixel data `width` pixels wide. */
export function colorAt(data: Uint8ClampedArray, width: number, x: number, y: number): PickedColor {
  const offset = (y * width + x) * 4;
  return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
}

/**
 * Clears every pixel near the picked colour in RGBA pixel data, in place, and says how many it
 * cleared. Every other pixel keeps its colour and its own transparency.
 */
export function clearColor(
  data: Uint8ClampedArray,
  color: PickedColor,
  distance: number = BACKGROUND_COLOR_DISTANCE
): number {
  const limit = distance * distance;
  let cleared = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue;
    const dr = data[offset] - color.r;
    const dg = data[offset + 1] - color.g;
    const db = data[offset + 2] - color.b;
    if (dr * dr + dg * dg + db * db > limit) continue;
    data[offset + 3] = 0;
    cleared++;
  }
  return cleared;
}

/**
 * The pixel of the picture under a point in a preview box that shows the whole picture centred
 * and scaled to fit, as `object-contain` does. A point on the empty margin maps to no pixel.
 */
export function pixelUnderPoint(
  point: { readonly x: number; readonly y: number },
  box: { readonly width: number; readonly height: number },
  picture: { readonly width: number; readonly height: number }
): { x: number; y: number } | null {
  if (box.width <= 0 || box.height <= 0 || picture.width <= 0 || picture.height <= 0) return null;
  const scale = Math.min(box.width / picture.width, box.height / picture.height);
  const left = (box.width - picture.width * scale) / 2;
  const top = (box.height - picture.height * scale) / 2;
  const x = Math.floor((point.x - left) / scale);
  const y = Math.floor((point.y - top) / scale);
  if (x < 0 || y < 0 || x >= picture.width || y >= picture.height) return null;
  return { x, y };
}

/**
 * Whether a picture may have its background cleared. A moving picture may not, since only its
 * first frame would come back.
 */
export async function canClearBackground(file: Blob): Promise<boolean> {
  if (file.type === 'image/gif') return false;
  return !isAnimatedImageBytes(await file.slice(0, 1024).arrayBuffer());
}

/**
 * Names the cleared copy of a picture after the original, marked as transparent and with the
 * extension of its new format. The mark also keeps a save-data name, a bare hash, from carrying
 * over, which would otherwise file the new bytes under the original's identifier.
 */
export function transparentFileName(name: string, type: string): string {
  const base = name.replace(/\.[^.]*$/, '') || 'image';
  return `${base}-transparent.${type === 'image/webp' ? 'webp' : 'png'}`;
}

/** What clearing a picture's background came to. */
export type ClearBackgroundResult =
  | { readonly kind: 'cleared'; readonly file: File; readonly color: PickedColor }
  /** The point fell outside the picture, on the preview's margin. */
  | { readonly kind: 'missed' }
  /** The browser could not decode or encode the picture. */
  | { readonly kind: 'failed' };

/**
 * Makes a transparent copy of a picture with the colour under a point of its preview cleared.
 *
 * The original is left untouched. The copy is written as WebP, or PNG where the browser cannot
 * write WebP, both of which keep transparency.
 */
export async function clearBackgroundAt(
  file: File,
  point: { readonly x: number; readonly y: number },
  box: { readonly width: number; readonly height: number }
): Promise<ClearBackgroundResult> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { kind: 'failed' };
  }
  try {
    const pixel = pixelUnderPoint(point, box, bitmap);
    if (!pixel) return { kind: 'missed' };
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return { kind: 'failed' };
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const color = colorAt(pixels.data, pixels.width, pixel.x, pixel.y);
    clearColor(pixels.data, color);
    context.putImageData(pixels, 0, 0);
    const blob = await canvasToBlobPreferWebP(canvas, 0.9);
    if (!blob) return { kind: 'failed' };
    return {
      kind: 'cleared',
      file: new File([blob], transparentFileName(file.name, blob.type), { type: blob.type }),
      color,
    };
  } catch {
    return { kind: 'failed' };
  } finally {
    bitmap.close();
  }
}
