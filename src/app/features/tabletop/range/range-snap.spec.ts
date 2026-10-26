import { halfCellSnapOf } from '@axe/features/tabletop/range/range-snap';

describe('where a range with no caster lands', () => {
  const free = { hex: false, follows: false };

  it('lands on a cell’s centre when dropped near one', () => {
    expect(halfCellSnapOf({ x: 70, y: 30 }, 50, free)).toEqual({ x: 75, y: 25 });
  });

  it('lands on a crossing of the lines when dropped near one', () => {
    expect(halfCellSnapOf({ x: 96, y: 54 }, 50, free)).toEqual({ x: 100, y: 50 });
  });

  it('leaves a range that follows a character, and a hex grid, to their own snapping', () => {
    expect(halfCellSnapOf({ x: 61, y: 39 }, 50, { hex: false, follows: true })).toBeNull();
    expect(halfCellSnapOf({ x: 61, y: 39 }, 50, { hex: true, follows: false })).toBeNull();
    expect(halfCellSnapOf({ x: 61, y: 39 }, 0, free)).toBeNull();
  });
});
