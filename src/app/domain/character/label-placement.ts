/**
 * Where a piece's name, resource bars and buffs sit as one block.
 *
 * `above` is the long-standing default: floating over the head of an ordinary piece, and at the top
 * middle of a part's region. The others place the block inside the picture's bounds (a part's own
 * region for a part).
 */
export const LABEL_PLACEMENTS = [
  'above',
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'topLeft',
  'topRight',
  'bottomLeft',
  'bottomRight',
] as const;

export type LabelPlacement = (typeof LABEL_PLACEMENTS)[number];

export const DEFAULT_LABEL_PLACEMENT: LabelPlacement = 'above';

/** Reads a saved value; anything unknown, including an empty value, is the default. */
export function labelPlacementOf(value: unknown): LabelPlacement {
  return LABEL_PLACEMENTS.find((placement) => placement === value) ?? DEFAULT_LABEL_PLACEMENT;
}

type Side = 'start' | 'center' | 'end';

const SIDES: Record<LabelPlacement, { horizontal: Side; vertical: Side }> = {
  above: { horizontal: 'center', vertical: 'start' },
  center: { horizontal: 'center', vertical: 'center' },
  top: { horizontal: 'center', vertical: 'start' },
  bottom: { horizontal: 'center', vertical: 'end' },
  left: { horizontal: 'start', vertical: 'center' },
  right: { horizontal: 'end', vertical: 'center' },
  topLeft: { horizontal: 'start', vertical: 'start' },
  topRight: { horizontal: 'end', vertical: 'start' },
  bottomLeft: { horizontal: 'start', vertical: 'end' },
  bottomRight: { horizontal: 'end', vertical: 'end' },
};

const OFFSET: Record<Side, number> = { start: 0, center: 50, end: 100 };
const ALIGN: Record<Side, string> = { start: 'flex-start', center: 'center', end: 'flex-end' };

/**
 * The style that puts a label block inside the box it is placed in. The block is anchored by the
 * same side of itself that it is placed on, so it never spills out of the box on that side.
 */
export function labelPlacementStyle(placement: LabelPlacement): Record<string, string> {
  const { horizontal, vertical } = SIDES[placement];
  return {
    left: `${OFFSET[horizontal]}%`,
    top: `${OFFSET[vertical]}%`,
    transform: `translate(-${OFFSET[horizontal]}%, -${OFFSET[vertical]}%)`,
    alignItems: ALIGN[horizontal],
  };
}
