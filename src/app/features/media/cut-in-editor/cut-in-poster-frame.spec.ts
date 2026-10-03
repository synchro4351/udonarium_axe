import { CutIn } from '@axe/domain/media/cut-in';
import { encodeCutInTracks } from '@axe/domain/media/cut-in-keyframe';
import { CutInLayer } from '@axe/domain/media/cut-in-layer';
import { sampleLayerAt } from '@axe/domain/media/cut-in-scene-timeline';
import {
  CUT_IN_CHARACTER_TOKEN,
  letterPoseAt,
  resolveCharacterName,
  splitLetters,
} from '@axe/domain/media/cut-in-text';
import { addLayer, ensureScene } from '@axe/features/media/cut-in-editor/cut-in-editor-ops';
import { posterFrameMs } from '@axe/features/media/cut-in-editor/cut-in-poster-frame';

describe('posterFrameMs()', () => {
  function emptyScene() {
    const cutIn = new CutIn();
    cutIn.initialize();
    const scene = ensureScene(cutIn);
    scene.durationMs = 2000;
    return scene;
  }

  function layerIn(scene: ReturnType<typeof emptyScene>): CutInLayer {
    return addLayer(scene, 'fill', 'band', { width: 640, height: 360 });
  }

  it('answers nought for a scene with nothing in it', () => {
    expect(posterFrameMs(null)).toBe(0);
    expect(posterFrameMs(emptyScene())).toBe(0);
  });

  it('answers nought for a scene that is already whole at the start', () => {
    const scene = emptyScene();
    layerIn(scene);

    expect(posterFrameMs(scene)).toBe(0);
  });

  it('waits for a layer that fades in', () => {
    const scene = emptyScene();
    const layer = layerIn(scene);
    layer.tracks = encodeCutInTracks({
      opacity: [
        { t: 0, v: 0 },
        { t: 600, v: 1 },
      ],
    });

    const at = posterFrameMs(scene);
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThanOrEqual(600);
    expect(sampleLayerAt(layer, at, scene.runningMs).opacity).toBeGreaterThan(0.9);
  });

  it('waits for the last letter in the chosen order, however it comes in', () => {
    for (const letterMotion of ['fade', 'slide'] as const) {
      const scene = emptyScene();
      const layer = addLayer(scene, 'text', 'call', { width: 640, height: 360 });
      Object.assign(layer, {
        text: 'ABCD',
        letterMotion,
        letterOrder: 'center',
        letterIntervalMs: 200,
        letterDurationMs: 200,
        letterDirection: 'left',
      });

      // From the middle out, the fourth letter goes last: 3 × 200 ms after the first, and 200 ms to come in.
      expect(posterFrameMs(scene), letterMotion).toBe(800);
    }
  });

  it('passes over the moments its letters are leaving', () => {
    const scene = emptyScene();
    const layer = addLayer(scene, 'text', 'call', { width: 640, height: 360 });
    // The layer is clearest late in the scene, which is when its letters would be leaving.
    layer.tracks = encodeCutInTracks({
      opacity: [
        { t: 0, v: 0 },
        { t: 1900, v: 1 },
      ],
    });
    Object.assign(layer, { text: 'AB', letterExit: 'none' });
    expect(posterFrameMs(scene)).toBeGreaterThan(940);

    // Leaving over a second, the first letter starts to go at 2000 - 1000 - 60.
    Object.assign(layer, { letterExit: 'fade', letterExitDurationMs: 1000 });
    const at = posterFrameMs(scene);
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(940);
  });

  it('waits until every popping letter has landed', () => {
    for (const title of ['参戦！', 'ここに\n参戦！']) {
      const scene = emptyScene();
      for (const [name, startMs] of [
        ['name', 460],
        ['call', 760],
      ] as const) {
        const layer = addLayer(scene, 'text', name, { width: 800, height: 400 });
        Object.assign(layer, { text: name === 'name' ? CUT_IN_CHARACTER_TOKEN : title, letterMotion: 'pop', startMs });
      }
      const at = posterFrameMs(scene);
      const popping = scene.layers.filter((layer) => layer.kind === 'text' && layer.letterMotion === 'pop');
      expect(popping.length, title).toBeGreaterThan(1);

      for (const layer of popping) {
        const sample = sampleLayerAt(layer, at, scene.runningMs);
        expect(sample.visible && sample.opacity > 0.9, `${title} ${layer.name}`).toBe(true);

        const letters = splitLetters(resolveCharacterName(layer.text, '')).filter((letter) => !letter.newline);
        expect(letters.length).toBeGreaterThan(0);
        for (const letter of letters) {
          const { opacity, scale, dy } = letterPoseAt(
            'pop',
            letter.index,
            layer.letterTiltDeg,
            layer.fontSizePx,
            at,
            layer.startMs
          );
          expect({ opacity, scale, dy }, `${title} ${letter.text}`).toEqual({ opacity: 1, scale: 1, dy: 0 });
        }
      }
    }
  });
});
