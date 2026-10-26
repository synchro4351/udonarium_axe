/**
 * Where a range with no caster lands on a square grid once let go: the nearest half cell, so that it
 * can be laid on a cell's centre or on a crossing of the lines by where it is dropped, with no menu
 * to choose between them. A range that follows a character, and a hex grid, keep their own snapping
 * (null).
 */
export function halfCellSnapOf(
  at: { x: number; y: number },
  gridSize: number,
  options: { hex: boolean; follows: boolean }
): { x: number; y: number } | null {
  if (options.hex || options.follows || !(gridSize > 0)) return null;
  const half = gridSize / 2;
  return { x: Math.round(at.x / half) * half, y: Math.round(at.y / half) * half };
}
