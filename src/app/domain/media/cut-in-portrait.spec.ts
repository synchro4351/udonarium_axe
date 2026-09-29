import {
  characterPortraitFitIn,
  CUT_IN_PORTRAIT_SILHOUETTE_URL,
  DEFAULT_CUT_IN_PORTRAIT_FIT,
  encodePortraitSnapshot,
  launchPortraitFit,
  legacyScenePortraitFit,
  makePortraitSnapshot,
  namesCharacter,
  panPortraitFit,
  parseCharacterPortraitFits,
  parsePortraitSnapshot,
  portraitFrameOf,
  resolvePortrait,
  withCharacterPortraitFit,
  zoomPortraitFit,
} from '@axe/domain/media/cut-in-portrait';

describe('cut-in portrait binding', () => {
  const template = {
    layers: [{ kind: 'image', portraitSlot: true }],
  };

  it('freezes the fit it was given at launch', () => {
    const fit = { zoom: 1.7, x: 42, y: 18 };
    const launch = makePortraitSnapshot(template, 'character-1', 'portrait-1', '', fit);
    fit.zoom = 3;

    expect(launch?.fit).toEqual({ zoom: 1.7, x: 42, y: 18 });
  });

  it('sends the default fit when none is given', () => {
    expect(makePortraitSnapshot(template, 'character-1', 'portrait-1')?.fit).toEqual(DEFAULT_CUT_IN_PORTRAIT_FIT);
  });

  it('does not bind an ordinary fixed-image scene', () => {
    expect(makePortraitSnapshot({ layers: [{ kind: 'image', portraitSlot: false }] }, 'c', 'i')).toBeNull();
  });

  it('fits every portrait slot to the head-and-shoulders frame for now', () => {
    expect(portraitFrameOf(template.layers)).toBe('bust');
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
    const naming = { layers: [{ kind: 'text', portraitSlot: false, text: '{character} 参戦！' }] };

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

describe('the fits a character keeps', () => {
  it('keeps a fit per frame and picture, and reads a picture never fitted as none', () => {
    const raw = withCharacterPortraitFit('', 'bust', 'smile', { zoom: 2, x: 40, y: 10 });

    expect(characterPortraitFitIn(raw, 'bust', 'smile')).toEqual({ zoom: 2, x: 40, y: 10 });
    expect(characterPortraitFitIn(raw, 'bust', 'angry')).toBeNull();
    expect(characterPortraitFitIn(raw, 'bust', '')).toBeNull();
    expect(JSON.parse(raw)).toEqual({ bust: { smile: { zoom: 2, x: 40, y: 10 } } });
  });

  it('holds a written fit to the range the slot can show', () => {
    const raw = withCharacterPortraitFit('', 'bust', 'smile', { zoom: 99, x: -5, y: 250 });

    expect(characterPortraitFitIn(raw, 'bust', 'smile')).toEqual({ zoom: 4, x: 0, y: 100 });
  });

  it('forgets a fit taken out, and leaves nothing behind once the last one goes', () => {
    const one = withCharacterPortraitFit('', 'bust', 'smile', { zoom: 2, x: 40, y: 10 });
    const two = withCharacterPortraitFit(one, 'bust', 'angry', { zoom: 1, x: 50, y: 0 });

    expect(characterPortraitFitIn(withCharacterPortraitFit(two, 'bust', 'smile', null), 'bust', 'smile')).toBeNull();
    expect(withCharacterPortraitFit(one, 'bust', 'smile', null)).toBe('');
  });

  it('keeps frames it does not know out, and reads anything unreadable as none', () => {
    expect(parseCharacterPortraitFits('{"fullBody":{"a":{"zoom":2,"x":1,"y":1}}}')).toEqual({});
    expect(parseCharacterPortraitFits('{broken')).toEqual({});
    expect(parseCharacterPortraitFits('[1,2]')).toEqual({});
    expect(parseCharacterPortraitFits('')).toEqual({});
  });

  it('keeps only the most recent 64 fits of a frame', () => {
    let raw = '';
    for (let i = 0; i < 70; i++) raw = withCharacterPortraitFit(raw, 'bust', `image-${i}`, { zoom: 1, x: i, y: 0 });

    const kept = parseCharacterPortraitFits(raw).bust!;
    expect(Object.keys(kept)).toHaveLength(64);
    expect(kept['image-0']).toBeUndefined();
    expect(kept['image-69']).toEqual({ zoom: 1, x: 69, y: 0 });
  });
});

describe('the fit a launch carries', () => {
  const legacy = '{"smile":{"zoom":3,"x":10,"y":20}}';

  it("takes the character's own fit ahead of anything an older scene kept", () => {
    const character = withCharacterPortraitFit('', 'bust', 'smile', { zoom: 2, x: 40, y: 10 });

    expect(launchPortraitFit(character, legacy, 'bust', 'smile')).toEqual({ zoom: 2, x: 40, y: 10 });
  });

  it('falls back to the fit an older scene kept, so a saved room plays as it did', () => {
    expect(launchPortraitFit('', legacy, 'bust', 'smile')).toEqual({ zoom: 3, x: 10, y: 20 });
    expect(legacyScenePortraitFit(legacy, 'smile')).toEqual({ zoom: 3, x: 10, y: 20 });
  });

  it('falls back to the default for a picture nobody fitted', () => {
    expect(launchPortraitFit('', legacy, 'bust', 'angry')).toEqual(DEFAULT_CUT_IN_PORTRAIT_FIT);
    expect(launchPortraitFit(null, null, 'bust', '')).toEqual(DEFAULT_CUT_IN_PORTRAIT_FIT);
  });
});
