import {
  characterPortraitFitIn,
  currentPortraitFit,
  CUT_IN_PORTRAIT_SILHOUETTE_URL,
  DEFAULT_CUT_IN_PORTRAIT_FIT,
  encodePortraitSnapshot,
  launchPortraitFit,
  legacyScenePortraitFit,
  makePortraitSnapshot,
  MAX_PORTRAIT_SCALE,
  MIN_PORTRAIT_SCALE,
  namesCharacter,
  normalizePortraitFit,
  panPortraitFit,
  parseCharacterPortraitFits,
  parsePortraitSnapshot,
  portraitFitCss,
  portraitFitFromLegacy,
  portraitFrameOf,
  portraitSlotCss,
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

  it('shows the whole picture, centred, until someone fits it', () => {
    expect(DEFAULT_CUT_IN_PORTRAIT_FIT).toEqual({ scale: 1, x: 0, y: 0 });
    expect(portraitFitCss(DEFAULT_CUT_IN_PORTRAIT_FIT)).toEqual({
      transform: 'translate(0%, 0%) scale(1)',
      origin: '50% 50%',
    });
  });

  it('carries a fit kept the old way to every peer unchanged', () => {
    const sent = makePortraitSnapshot(template, 'c', 'i', '', { zoom: 2, x: 30, y: 10 });

    expect(parsePortraitSnapshot(encodePortraitSnapshot(sent))?.fit).toEqual({ zoom: 2, x: 30, y: 10 });
  });
});

describe('moving and sizing a portrait', () => {
  it('moves the picture exactly as far as the pointer, the same way at any size', () => {
    for (const scale of [0.4, 1, 3]) {
      const dragged = panPortraitFit({ scale, x: 0, y: 0 }, 40, -20);
      expect(dragged).toEqual({ scale, x: 40, y: -20 });
    }
  });

  it('lets the picture be taken past the edges of the frame', () => {
    // Half the frame's width to the left puts the whole picture's centre on the frame's left edge.
    expect(panPortraitFit({ scale: 1, x: 0, y: 0 }, -170, 250)).toEqual({ scale: 1, x: -170, y: 250 });
    // Only a picture dragged wholly off the frame is held back, with its edge still on the frame's.
    expect(panPortraitFit({ scale: 1, x: 0, y: 0 }, -10_000, 0).x).toBe(-340);
  });

  it('sizes the picture around a point, keeping what is under it in place', () => {
    const fit = { scale: 1, x: 20, y: 0 };
    const at = { x: 100, y: -50 };
    const sized = zoomPortraitFit(fit, 2, at);

    expect(sized.scale).toBe(2);
    // The picture's point under `at` was (at - centre) / scale away from its centre, and still is under `at`.
    const before = { x: (at.x - fit.x) / fit.scale, y: (at.y - fit.y) / fit.scale };
    expect(sized.x + before.x * sized.scale).toBeCloseTo(at.x);
    expect(sized.y + before.y * sized.scale).toBeCloseTo(at.y);
    // Around the frame's centre by default, and within the sizes a slot can show.
    expect(zoomPortraitFit({ scale: 1, x: 10, y: 0 }, 0.5)).toEqual({ scale: 0.5, x: 5, y: 0 });
    expect(zoomPortraitFit(fit, 1000).scale).toBe(MAX_PORTRAIT_SCALE);
    expect(zoomPortraitFit(fit, 0.001).scale).toBe(MIN_PORTRAIT_SCALE);
  });

  it('puts the picture where an old fit put it, for any proportions', () => {
    // The old default: covering the frame, top and centre.
    expect(portraitFitFromLegacy({ zoom: 1, x: 50, y: 0 }, 340 / 400)).toEqual({ scale: 1, x: 0, y: 0 });

    // A tall picture, half as wide as high, covered the frame's width: 340 by 680, top aligned.
    // Drawn whole it is 200 by 400, so it was 1.7 times that, with its centre 140 below the frame's.
    expect(portraitFitFromLegacy({ zoom: 1, x: 50, y: 0 }, 0.5)).toEqual({ scale: 1.7, x: 0, y: 140 });

    // Blown up twice around the frame's bottom-left corner: the picture's centre, 170 across and 340
    // up from that corner, goes twice as far, to 340 across and 680 up.
    expect(portraitFitFromLegacy({ zoom: 2, x: 0, y: 100 }, 0.5)).toEqual({ scale: 3.4, x: 170, y: -480 });
  });

  it('reads an old fit and a current one each as what it is', () => {
    expect(normalizePortraitFit({ zoom: 2, x: 30, y: 10 })).toEqual({ zoom: 2, x: 30, y: 10 });
    expect(normalizePortraitFit({ scale: 2, x: -30, y: 10 })).toEqual({ scale: 2, x: -30, y: 10 });
    expect(normalizePortraitFit({ scale: 'x', zoom: 3 })).toEqual({ scale: 1, x: 0, y: 0 });
    expect(normalizePortraitFit(null)).toEqual(DEFAULT_CUT_IN_PORTRAIT_FIT);
    expect(currentPortraitFit({ scale: 2, x: 1, y: 2 }, 0.5)).toEqual({ scale: 2, x: 1, y: 2 });
    expect(currentPortraitFit({ zoom: 1, x: 50, y: 0 }, 0.5)).toEqual({ scale: 1.7, x: 0, y: 140 });
  });
});

describe('drawing a portrait slot', () => {
  it('draws the picture whole in the frame, moved by a share of the frame', () => {
    expect(portraitSlotCss({ scale: 0.5, x: -170, y: 40 }, { width: 340, height: 400 })).toEqual({
      box: { left: 0, top: 0, width: 340, height: 400 },
      objectFit: 'contain',
      objectPosition: '50% 50%',
      transform: 'translate(-50%, 10%) scale(0.5)',
      origin: '50% 50%',
    });
  });

  it('covers a slot of another shape with the frame, centred', () => {
    expect(portraitSlotCss(DEFAULT_CUT_IN_PORTRAIT_FIT, { width: 340, height: 800 }).box).toEqual({
      left: -170,
      top: 0,
      width: 680,
      height: 800,
    });
  });

  it('draws an old fit the way it always was', () => {
    expect(portraitSlotCss({ zoom: 2, x: 30, y: 10 }, { width: 340, height: 400 })).toEqual({
      box: { left: 0, top: 0, width: 340, height: 400 },
      objectFit: null,
      objectPosition: '30% 10%',
      transform: 'scale(2)',
      origin: '30% 10%',
    });
  });

  it('stands the silhouette on the bottom of the frame', () => {
    const face = resolvePortrait(null, () => '');

    // Its square drawing fills the frame's 340 across, leaving 60 of the 400 down to drop it by.
    expect(face.fit).toEqual({ scale: 1, x: 0, y: 30 });
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
