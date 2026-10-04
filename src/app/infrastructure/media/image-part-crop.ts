import { ImagePart } from '@axe/domain/character/image-part';

/** Transparent square padding preserves the aspect ratio in an ordinary character token. */
export async function cropImagePart(image: HTMLImageElement, part: ImagePart): Promise<Blob> {
  const side = Math.max(part.width, part.height);
  const output = Math.min(4096, Math.ceil(side));
  const scale = output / side;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = output;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(
    image,
    part.x,
    part.y,
    part.width,
    part.height,
    ((side - part.width) / 2) * scale,
    ((side - part.height) / 2) * scale,
    part.width * scale,
    part.height * scale
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))), 'image/png');
  });
}

/**
 * The whole picture's frame with only the part drawn in, for linked parts stacked on one spot.
 *
 * Everything outside the region is transparent, so the parts laid over each other show the
 * original picture. The longer side is held to 4,096px.
 */
export async function cropImagePartFrame(image: HTMLImageElement, part: ImagePart): Promise<Blob> {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const scale = Math.min(1, 4096 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(
    image,
    part.x,
    part.y,
    part.width,
    part.height,
    part.x * scale,
    part.y * scale,
    part.width * scale,
    part.height * scale
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))), 'image/png');
  });
}

export function loadPartImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(url)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image unavailable'));
    image.src = url;
  });
}
