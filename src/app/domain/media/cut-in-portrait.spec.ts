import {
  CUT_IN_PORTRAIT_SILHOUETTE_URL,
  makePortraitSnapshot,
  parsePortraitSnapshot,
  portraitFitFor,
  resolvePortrait,
  withPortraitFit,
} from '@axe/domain/media/cut-in-portrait';

describe('cut-in portrait binding', () => {
  const template = {
    layers: [{ kind: 'image', portraitSlot: true }],
    portraitFits: '',
  };

  it('keeps a fit for each image and freezes the chosen fit at launch', () => {
    template.portraitFits = withPortraitFit('', 'portrait-1', { zoom: 1.7, x: 42, y: 18 });
    const launch = makePortraitSnapshot(template, 'character-1', 'portrait-1');
    template.portraitFits = withPortraitFit(template.portraitFits, 'portrait-1', { zoom: 3, x: 50, y: 50 });

    expect(launch?.fit).toEqual({ zoom: 1.7, x: 42, y: 18 });
    expect(portraitFitFor(template.portraitFits, 'portrait-1').zoom).toBe(3);
  });

  it('does not bind an ordinary fixed-image scene', () => {
    expect(
      makePortraitSnapshot({ layers: [{ kind: 'image', portraitSlot: false }], portraitFits: '' }, 'c', 'i')
    ).toBeNull();
  });

  it('shows the built-in silhouette when the chosen image is missing', () => {
    const launch = makePortraitSnapshot(template, 'character-1', 'missing');
    expect(resolvePortrait(launch, () => '').url).toBe(CUT_IN_PORTRAIT_SILHOUETTE_URL);
    expect(resolvePortrait(launch, () => '').silhouette).toBe(true);
  });

  it('accepts an absent launch snapshot from an older room', () => {
    expect(parsePortraitSnapshot('')).toBeNull();
    expect(parsePortraitSnapshot('{broken')).toBeNull();
  });
});
