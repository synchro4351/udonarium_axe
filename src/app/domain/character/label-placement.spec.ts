import {
  DEFAULT_LABEL_PLACEMENT,
  LABEL_PLACEMENTS,
  labelPlacementOf,
  labelPlacementStyle,
} from '@axe/domain/character/label-placement';

describe('label placement', () => {
  it('falls back to the default for an empty or unknown value', () => {
    for (const value of ['', 'sideways', undefined, null, 3]) {
      expect(labelPlacementOf(value)).toBe(DEFAULT_LABEL_PLACEMENT);
    }
    for (const placement of LABEL_PLACEMENTS) expect(labelPlacementOf(placement)).toBe(placement);
  });

  it('keeps the default at the top middle, as a part always showed it', () => {
    expect(labelPlacementStyle('above')).toEqual({
      left: '50%',
      top: '0%',
      transform: 'translate(-50%, -0%)',
      alignItems: 'center',
    });
  });

  it('anchors each preset by the side it sits on so the block stays inside the box', () => {
    expect(labelPlacementStyle('center')).toMatchObject({ left: '50%', top: '50%' });
    expect(labelPlacementStyle('bottomRight')).toMatchObject({
      left: '100%',
      top: '100%',
      transform: 'translate(-100%, -100%)',
      alignItems: 'flex-end',
    });
    expect(labelPlacementStyle('left')).toMatchObject({ left: '0%', top: '50%', alignItems: 'flex-start' });
    expect(labelPlacementStyle('topRight')).toMatchObject({ left: '100%', top: '0%' });
  });

  it('gives every preset a distinct place except the default, which equals top', () => {
    const places = LABEL_PLACEMENTS.filter((placement) => placement !== 'above').map((placement) =>
      JSON.stringify(labelPlacementStyle(placement))
    );
    expect(new Set(places).size).toBe(places.length);
    expect(labelPlacementStyle('above')).toEqual(labelPlacementStyle('top'));
  });
});
