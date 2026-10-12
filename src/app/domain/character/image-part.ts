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

type ImageRegion = Pick<ImagePart, 'x' | 'y' | 'width' | 'height'>;

/** The smallest width and height of a part, in source pixels. */
export const MIN_IMAGE_PART_SIZE = 2;

/**
 * The part under a point, or -1. Parts may overlap, so the last one wins, which is the one drawn on top.
 * Points on an edge do not count as inside.
 */
export function topmostImagePartAt(point: ImagePoint, parts: readonly ImageRegion[]): number {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (point.x > part.x && point.x < part.x + part.width && point.y > part.y && point.y < part.y + part.height)
      return i;
  }
  return -1;
}

/** Which side or corner of a region is being dragged. */
export type ImagePartHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const IMAGE_PART_HANDLES: readonly ImagePartHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Where a handle sits on a region, as fractions of its width and height. */
export function imagePartHandleAnchor(handle: ImagePartHandle): { fx: number; fy: number } {
  return {
    fx: handle.includes('w') ? 0 : handle.includes('e') ? 1 : 0.5,
    fy: handle.includes('n') ? 0 : handle.includes('s') ? 1 : 0.5,
  };
}

/** Moves a region by the given distance, keeping its size and staying inside the image. */
export function moveImagePart<T extends ImageRegion>(
  part: T,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number
): T {
  return {
    ...part,
    x: Math.round(Math.max(0, Math.min(imageWidth - part.width, part.x + dx))),
    y: Math.round(Math.max(0, Math.min(imageHeight - part.height, part.y + dy))),
  };
}

/** Where a dragged edge ends up: inside the image, and never closer to the fixed edge than the minimum. */
function draggedEdge(fixed: number, pointer: number, limit: number): number {
  const edge = Math.max(0, Math.min(limit, Math.round(pointer)));
  if (Math.abs(edge - fixed) >= MIN_IMAGE_PART_SIZE) return edge;
  const direction = edge >= fixed ? 1 : -1;
  const candidate = fixed + direction * MIN_IMAGE_PART_SIZE;
  return candidate < 0 || candidate > limit ? fixed - direction * MIN_IMAGE_PART_SIZE : candidate;
}

/**
 * Resizes a region by dragging one handle to a point in the image. The side opposite the handle stays
 * where it was; dragging past it turns the region over instead of collapsing it.
 */
export function resizeImagePart<T extends ImageRegion>(
  part: T,
  handle: ImagePartHandle,
  point: ImagePoint,
  imageWidth: number,
  imageHeight: number
): T {
  let { x, y, width, height } = part;
  if (handle.includes('w') || handle.includes('e')) {
    const fixed = handle.includes('w') ? part.x + part.width : part.x;
    const edge = draggedEdge(fixed, point.x, imageWidth);
    x = Math.min(fixed, edge);
    width = Math.abs(edge - fixed);
  }
  if (handle.includes('n') || handle.includes('s')) {
    const fixed = handle.includes('n') ? part.y + part.height : part.y;
    const edge = draggedEdge(fixed, point.y, imageHeight);
    y = Math.min(fixed, edge);
    height = Math.abs(edge - fixed);
  }
  return { ...part, x, y, width, height };
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
        part.width >= MIN_IMAGE_PART_SIZE &&
        part.height >= MIN_IMAGE_PART_SIZE &&
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
