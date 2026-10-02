export interface ImagePoint {
  readonly x: number;
  readonly y: number;
}

export interface ImagePart {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const MAX_IMAGE_PARTS = 20;

/** Maps a pointer in the displayed image to bounded source-image pixels. */
export function imagePointAt(
  pointer: ImagePoint,
  bounds: { left: number; top: number; width: number; height: number },
  width: number,
  height: number
): ImagePoint {
  return {
    x: Math.max(0, Math.min(width, ((pointer.x - bounds.left) / bounds.width) * width)),
    y: Math.max(0, Math.min(height, ((pointer.y - bounds.top) / bounds.height) * height)),
  };
}

export function imagePartBetween(start: ImagePoint, end: ImagePoint, name: string): ImagePart {
  return {
    name,
    x: Math.floor(Math.min(start.x, end.x)),
    y: Math.floor(Math.min(start.y, end.y)),
    width: Math.ceil(Math.max(start.x, end.x)) - Math.floor(Math.min(start.x, end.x)),
    height: Math.ceil(Math.max(start.y, end.y)) - Math.floor(Math.min(start.y, end.y)),
  };
}

export function validImageParts(parts: readonly ImagePart[], width: number, height: number): boolean {
  return (
    Number.isFinite(width) &&
    width > 0 &&
    Number.isFinite(height) &&
    height > 0 &&
    parts.length > 0 &&
    parts.length <= MAX_IMAGE_PARTS &&
    parts.every(
      (part) =>
        [part.x, part.y, part.width, part.height].every(Number.isFinite) &&
        part.x >= 0 &&
        part.y >= 0 &&
        part.width >= 2 &&
        part.height >= 2 &&
        part.x + part.width <= width &&
        part.y + part.height <= height &&
        part.name.trim().length > 0 &&
        part.name.trim().length <= 80
    )
  );
}

/** Keeps the selected regions' relative centres when placing independent square pieces. */
export function imagePartPlacement(part: ImagePart, imageWidth: number, imageHeight: number, grid: number) {
  const scale = (grid * 4) / Math.max(imageWidth, imageHeight);
  return {
    x: (part.x + part.width / 2 - imageWidth / 2) * scale,
    y: (part.y + part.height / 2 - imageHeight / 2) * scale,
    size: Math.max(0.2, (Math.max(part.width, part.height) * scale) / grid),
  };
}
