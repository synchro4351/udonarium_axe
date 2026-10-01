import { CutIn } from '@axe/domain/media/cut-in';
import { encodeCutInTracks } from '@axe/domain/media/cut-in-keyframe';
import { CutInLayer } from '@axe/domain/media/cut-in-layer';
import { sampleLayerAt } from '@axe/domain/media/cut-in-scene-timeline';
import { letterPoseAt, resolveCharacterName, splitLetters } from '@axe/domain/media/cut-in-text';
import { addLayer, ensureScene } from '@axe/features/media/cut-in-editor/cut-in-editor-ops';
import { posterFrameMs } from '@axe/features/media/cut-in-editor/cut-in-poster-frame';
import {
  createCutInSceneTemplate,
  CUT_IN_SCENE_TEMPLATES,
} from '@axe/features/media/cut-in-list/cut-in-scene-templates';

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

  it('opens every template on a moment that shows something', () => {
    for (const kind of CUT_IN_SCENE_TEMPLATES) {
      const scene = createCutInSceneTemplate(kind, kind).scene!;
      const at = posterFrameMs(scene);
      const shown = scene.layers.filter((layer) => {
        const sample = sampleLayerAt(layer, at, scene.runningMs);
        return !layer.hidden && sample.visible && sample.opacity > 0.5;
      });

      expect(shown.length, kind).toBeGreaterThan(0);
    }
  });

  it('waits until every popping letter of the portrait template has landed', () => {
    for (const title of ['参戦！', 'ここに\n参戦！']) {
      const scene = createCutInSceneTemplate('portrait', title).scene!;
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
