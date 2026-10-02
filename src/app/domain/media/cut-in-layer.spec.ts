import { TestBed } from '@angular/core/testing';
import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import { encodeCutInTracks } from '@axe/domain/media/cut-in-keyframe';
import { CutInLayer, isCutInLayerKind, isCutInTextAlign } from '@axe/domain/media/cut-in-layer';

describe('CutInLayer', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  function makeLayer(): CutInLayer {
    const layer = new CutInLayer();
    layer.initialize();
    return layer;
  }

  describe('the defaults of the synchronised fields', () => {
    it('starts as a picture with nothing chosen', () => {
      const layer = makeLayer();

      expect(layer.kind).toBe('image');
      expect(layer.imageIdentifier).toBe('');
      expect(layer.name).toBe('');
    });

    it('starts in the corner at a readable size', () => {
      const layer = makeLayer();

      expect(layer.x).toBe(0);
      expect(layer.y).toBe(0);
      expect(layer.width).toBeGreaterThan(0);
      expect(layer.height).toBeGreaterThan(0);
    });

    it('starts turning around its middle', () => {
      const layer = makeLayer();

      expect(layer.anchorX).toBe(0.5);
      expect(layer.anchorY).toBe(0.5);
    });

    it('starts at rest and fully there', () => {
      const layer = makeLayer();

      expect(layer.scaleX).toBe(1);
      expect(layer.scaleY).toBe(1);
      expect(layer.rotation).toBe(0);
      expect(layer.opacity).toBe(1);
      expect(layer.blur).toBe(0);
    });

    it('starts showing and unlocked', () => {
      const layer = makeLayer();

      expect(layer.hidden).toBe(false);
      expect(layer.locked).toBe(false);
    });

    it('starts without moving', () => {
      const layer = makeLayer();

      expect(layer.tracks).toBe('');
      expect(layer.trackSet).toEqual({});
    });
  });

  describe('trackSet', () => {
    it('reads what was written into it', () => {
      const layer = makeLayer();
      layer.tracks = encodeCutInTracks({ x: [{ t: 0, v: -100 }] });

      expect(layer.trackSet.x).toEqual([{ t: 0, v: -100 }]);
    });

    it('hands back the same reading until the tracks are written again', () => {
      const layer = makeLayer();
      layer.tracks = encodeCutInTracks({ x: [{ t: 0, v: -100 }] });

      expect(layer.trackSet).toBe(layer.trackSet);
    });

    it('reads afresh once they are', () => {
      const layer = makeLayer();
      layer.tracks = encodeCutInTracks({ x: [{ t: 0, v: -100 }] });
      const before = layer.trackSet;

      layer.tracks = encodeCutInTracks({ x: [{ t: 0, v: 250 }] });

      expect(layer.trackSet).not.toBe(before);
      expect(layer.trackSet.x?.[0].v).toBe(250);
    });
  });

  describe('lastMomentMs', () => {
    it('is nothing for a layer that stays put from the start', () => {
      expect(makeLayer().lastMomentMs).toBe(0);
    });

    it('reaches the end of its time on screen', () => {
      const layer = makeLayer();
      layer.endMs = 1500;

      expect(layer.lastMomentMs).toBe(1500);
    });

    it('reaches its last key where that comes later', () => {
      const layer = makeLayer();
      layer.endMs = 500;
      layer.tracks = encodeCutInTracks({ opacity: [{ t: 2400, v: 0 }] });

      expect(layer.lastMomentMs).toBe(2400);
    });
  });

  describe('the detailed letter controls', () => {
    const detailed = {
      letterMotion: 'slide',
      letterOrder: 'center',
      letterIntervalMs: 130,
      letterDurationMs: 500,
      letterTiltMode: 'uniform',
      letterExit: 'rise',
      letterExitDurationMs: 400,
      letterDirection: 'left',
    } as const;

    function detailedLayer(): CutInLayer {
      const layer = makeLayer();
      layer.kind = 'text';
      layer.text = '{character} 👍🏽';
      Object.assign(layer, detailed);
      return layer;
    }

    it('starts on the way letters moved before there were controls', () => {
      expect(makeLayer()).toMatchObject({
        letterOrder: 'forward',
        letterIntervalMs: 60,
        letterDurationMs: 260,
        letterTiltMode: 'alternate',
        letterExit: 'none',
        letterExitDurationMs: 260,
        letterDirection: 'up',
      });
    });

    it('keeps them through a save and a copy, with the text left as one string', () => {
      const layer = detailedLayer();

      const restored = ObjectSerializer.instance.parseXml(layer.toXml()) as CutInLayer;
      expect(restored).toMatchObject({ ...detailed, text: '{character} 👍🏽' });
      expect(layer.clone()).toMatchObject(detailed);
    });

    it('sends them to the room as attributes of the layer, and takes them from it', () => {
      const layer = detailedLayer();
      const context = layer.toContext();

      expect((context.syncData as { attributes: object }).attributes).toMatchObject(detailed);

      const other = makeLayer();
      other.apply({ ...context, identifier: other.identifier });
      expect(other).toMatchObject(detailed);
    });

    it('reads a cut-in saved before the controls existed as it always played', () => {
      const restored = ObjectSerializer.instance.parseXml(
        '<cut-in-layer kind="text" text="参戦" letterMotion="pop"></cut-in-layer>'
      ) as CutInLayer;

      expect(restored).toMatchObject({ letterMotion: 'pop', letterOrder: 'forward', letterIntervalMs: 60 });
    });

    it('leaves a number a file garbles at its default', () => {
      const restored = ObjectSerializer.instance.parseXml(
        '<cut-in-layer kind="text" letterIntervalMs="soon" letterOrder="sideways"></cut-in-layer>'
      ) as CutInLayer;

      expect(restored.letterIntervalMs).toBe(60);
      // Kept as written, and read as the default wherever it is played.
      expect(restored.letterOrder).toBe('sideways');
    });
  });
});

describe('isCutInLayerKind()', () => {
  it('knows the kinds a layer may be', () => {
    expect(isCutInLayerKind('image')).toBe(true);
    expect(isCutInLayerKind('text')).toBe(true);
    expect(isCutInLayerKind('fill')).toBe(true);
  });

  it('turns away anything else', () => {
    expect(isCutInLayerKind('video')).toBe(false);
    expect(isCutInLayerKind(undefined)).toBe(false);
  });
});

describe('isCutInTextAlign()', () => {
  it('knows where words may sit', () => {
    expect(isCutInTextAlign('left')).toBe(true);
    expect(isCutInTextAlign('center')).toBe(true);
    expect(isCutInTextAlign('right')).toBe(true);
  });

  it('turns away anything else', () => {
    expect(isCutInTextAlign('justify')).toBe(false);
  });
});
