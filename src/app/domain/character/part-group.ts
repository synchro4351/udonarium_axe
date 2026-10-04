import type { GameCharacter } from '@axe/domain/character/game-character';
import type { ImagePart } from '@axe/domain/character/image-part';

/** A rectangle as fractions of the picture's width and height, each from 0 to 1. */
export interface PartRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A part's rectangle together with the picture's aspect ratio (width over height). */
export interface PartFrame extends PartRegion {
  readonly aspect: number;
}

/** Fewer than two would be a single piece pretending to be a group. */
export const MIN_LINKED_PARTS = 2;

const EPSILON = 1e-6;

function fraction(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

/** The region as saved on a part: four fractions and the picture's aspect ratio. */
export function encodePartRegion(part: Pick<ImagePart, 'x' | 'y' | 'width' | 'height'>, width: number, height: number) {
  return [part.x / width, part.y / height, part.width / width, part.height / height, width / height]
    .map(fraction)
    .join(' ');
}

/** Reads a saved region; null for anything that is not a rectangle inside the picture. */
export function decodePartRegion(text: string): PartFrame | null {
  const values = text.trim().split(/\s+/).map(Number);
  if (values.length !== 5 || !values.every(Number.isFinite)) return null;
  const [x, y, width, height, aspect] = values;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || aspect <= 0) return null;
  if (x + width > 1 + EPSILON || y + height > 1 + EPSILON) return null;
  return { x, y, width, height, aspect };
}

interface PartLike {
  readonly identifier: string;
  partGroup: string;
  partRegion: string;
  readonly location: { name: string };
}

/** Whether the piece is one part of a linked group. */
export function isLinkedPart(character: Pick<PartLike, 'partGroup' | 'partRegion'>): boolean {
  return character.partGroup.length > 0 && decodePartRegion(character.partRegion) !== null;
}

/** The other parts of the same group that are out on the table. */
export function linkedPartsOf<T extends PartLike>(part: T, characters: Iterable<T>): T[] {
  if (!isLinkedPart(part)) return [];
  const linked: T[] = [];
  for (const other of characters) {
    if (other === part || other.identifier === part.identifier) continue;
    if (other.partGroup !== part.partGroup || !isLinkedPart(other)) continue;
    if (other.location.name !== 'table') continue;
    linked.push(other);
  }
  return linked;
}

/** The name a part is listed and speaks under. */
export function partDisplayName(groupName: string, partName: string): string {
  const group = groupName.trim();
  const part = partName.trim();
  if (!group) return part;
  if (!part) return group;
  return `${group}(${part})`;
}

/** Takes a piece out of its group, leaving an ordinary character. */
export function clearPartGroup(
  character: Pick<GameCharacter, 'partGroup' | 'partGroupName' | 'partName' | 'partRegion'>
) {
  character.partGroup = '';
  character.partGroupName = '';
  character.partName = '';
  character.partRegion = '';
}

/** What the parts of a group keep in common. */
export interface PartTransform {
  readonly x: number;
  readonly y: number;
  readonly surface: string;
  readonly posZ: number;
  readonly rotate: number;
  readonly roll: number;
  readonly size: number;
  readonly altitude: number;
  readonly isLock: boolean;
}

export function partTransformOf(character: GameCharacter): PartTransform {
  return {
    x: character.location.x,
    y: character.location.y,
    surface: character.location.surface ?? '',
    posZ: character.posZ,
    rotate: character.rotate,
    roll: character.roll,
    size: character.size,
    altitude: character.altitude,
    isLock: character.isLock,
  };
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

export function samePartTransform(a: PartTransform, b: PartTransform): boolean {
  return (
    near(a.x, b.x) &&
    near(a.y, b.y) &&
    a.surface === b.surface &&
    near(a.posZ, b.posZ) &&
    near(a.rotate, b.rotate) &&
    near(a.roll, b.roll) &&
    near(a.size, b.size) &&
    near(a.altitude, b.altitude) &&
    a.isLock === b.isLock
  );
}

/** Writes only the values that differ, so an aligned part sends nothing. Says whether anything changed. */
export function applyPartTransform(character: GameCharacter, transform: PartTransform): boolean {
  const current = partTransformOf(character);
  if (samePartTransform(current, transform)) return false;
  if (!near(current.x, transform.x) || !near(current.y, transform.y) || current.surface !== transform.surface) {
    character.location = {
      ...character.location,
      x: transform.x,
      y: transform.y,
      surface: transform.surface || undefined,
    };
  }
  if (!near(current.posZ, transform.posZ)) character.posZ = transform.posZ;
  if (!near(current.rotate, transform.rotate)) character.rotate = transform.rotate;
  if (!near(current.roll, transform.roll)) character.roll = transform.roll;
  if (!near(current.size, transform.size)) character.size = transform.size;
  if (!near(current.altitude, transform.altitude)) character.altitude = transform.altitude;
  if (current.isLock !== transform.isLock) character.isLock = transform.isLock;
  // The place is one synced object; writing into it does not mark the piece changed by itself.
  character.update();
  return true;
}

/**
 * Where the region lies in the box the picture is drawn in.
 *
 * A picture fitted into a square box (`object-fit: contain`) is letterboxed, so its region moves
 * and shrinks with it; otherwise the box takes the picture's own shape.
 */
export function partBoxRegion(frame: PartFrame, contain: boolean): PartRegion {
  if (!contain || near(frame.aspect, 1)) return { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
  if (frame.aspect > 1) {
    const scale = 1 / frame.aspect;
    const top = (1 - scale) / 2;
    return { x: frame.x, y: top + frame.y * scale, width: frame.width, height: frame.height * scale };
  }
  const scale = frame.aspect;
  const left = (1 - scale) / 2;
  return { x: left + frame.x * scale, y: frame.y, width: frame.width * scale, height: frame.height };
}

function percent(value: number): string {
  return `${(Math.round(value * 1e6) / 1e4).toString()}%`;
}

/**
 * The clip that limits a part's picture, and so what the pointer can hit, to its own region.
 *
 * Clipped-out pixels are not hit-tested, so stacked full-frame parts each answer only inside their
 * rectangle, however the picture is turned in 2D or 3D.
 */
export function partClipPath(region: PartRegion): string {
  const top = region.y;
  const right = 1 - region.x - region.width;
  const bottom = 1 - region.y - region.height;
  const left = region.x;
  return `inset(${[top, right, bottom, left].map((value) => percent(Math.max(0, value))).join(' ')})`;
}

/** The box-relative position and size of a region, as CSS percentages. */
export function partRegionStyle(region: PartRegion): Record<string, string> {
  return {
    left: percent(region.x),
    top: percent(region.y),
    width: percent(region.width),
    height: percent(region.height),
  };
}

/** Which region a box-relative point falls in, or -1. Points on a shared edge go to the earlier part. */
export function partRegionAt(point: { x: number; y: number }, regions: readonly PartRegion[]): number {
  return regions.findIndex(
    (region) =>
      point.x >= region.x &&
      point.x <= region.x + region.width &&
      point.y >= region.y &&
      point.y <= region.y + region.height
  );
}

export interface PartAnchorView {
  readonly mode2d: boolean;
  readonly yawDeg: number;
  readonly pitchDeg?: number;
  readonly tiltDeg?: number;
  readonly contain?: boolean;
  readonly specifiedHeightPx?: number;
}

/** Maps the picture region through the inverse camera rotation used by its billboard. */
export function partAnchorOffset(
  frame: PartFrame,
  sizePx: number,
  view: PartAnchorView
): { dx: number; dy: number; dz: number } {
  const contain = view.contain ?? view.mode2d;
  const region = partBoxRegion(frame, contain);
  const height = contain ? sizePx : (view.specifiedHeightPx ?? sizePx / frame.aspect);
  const width = contain ? sizePx : height * frame.aspect;
  const across = (region.x + region.width / 2 - 0.5) * width;
  const vertical = (region.y + region.height / 2 - (contain ? 0.5 : 1)) * height;
  const yaw = (view.yawDeg * Math.PI) / 180;
  const pitch = ((view.pitchDeg ?? (view.mode2d ? 0 : 90)) * Math.PI) / 180;
  const tilt = ((view.tiltDeg ?? 0) * Math.PI) / 180;
  const x = across * Math.cos(tilt);
  const initialZ = across * Math.sin(tilt);
  const y = vertical * Math.cos(pitch) + initialZ * Math.sin(pitch);
  const z = -vertical * Math.sin(pitch) + initialZ * Math.cos(pitch);
  return {
    dx: x * Math.cos(yaw) + y * Math.sin(yaw),
    dy: -x * Math.sin(yaw) + y * Math.cos(yaw),
    dz: z,
  };
}
