import {
  CUT_IN_PORTRAIT_SILHOUETTE_URL,
  encodePortraitSnapshot,
  makePortraitSnapshot,
  namesCharacter,
  panPortraitFit,
  parsePortraitSnapshot,
  portraitFitFor,
  resolvePortrait,
  withPortraitFit,
  zoomPortraitFit,
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

  it('carries the launched name to every peer, and reads a launch from before names as nameless', () => {
    const sent = makePortraitSnapshot(template, 'character-1', 'portrait-1', '  アリス ');
    const received = parsePortraitSnapshot(encodePortraitSnapshot(sent));

    expect(received?.characterName).toBe('アリス');
    expect(parsePortraitSnapshot('{"c":"x","i":"y","f":{"zoom":1,"x":50,"y":0}}')?.characterName).toBe('');
  });

  it('sends a snapshot for a scene that names the character but has no portrait slot', () => {
    const naming = { layers: [{ kind: 'text', portraitSlot: false, text: '{character} 参戦！' }], portraitFits: '' };

    expect(namesCharacter(naming.layers)).toBe(true);
    expect(makePortraitSnapshot(naming, '', '', '')).toMatchObject({ characterName: '', imageIdentifier: '' });
    expect(namesCharacter([{ kind: 'image', portraitSlot: false, text: '{character}' }])).toBe(false);
  });

  it('moves the picture with the pointer and sizes it within the range the slot shows', () => {
    const fit = { zoom: 2, x: 50, y: 50 };
    const dragged = panPortraitFit(fit, 40, -20, { width: 200, height: 400 });

    // Dragged right and up, the picture shows more of its left side and its bottom.
    expect(dragged.x).toBeCloseTo(40);
    expect(dragged.y).toBeCloseTo(52.5);
    expect(panPortraitFit(fit, -10_000, 0, { width: 200, height: 400 }).x).toBe(100);
    expect(zoomPortraitFit(fit, 1.5).zoom).toBe(3);
    expect(zoomPortraitFit(fit, 10).zoom).toBe(4);
  });
});
