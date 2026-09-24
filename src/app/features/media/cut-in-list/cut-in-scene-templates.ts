import { CutIn } from '@axe/domain/media/cut-in';
import { applyLayerPreset } from '@axe/domain/media/cut-in-layer-presets';
import { addLayer, ensureScene } from '@axe/features/media/cut-in-editor/cut-in-editor-ops';

export const CUT_IN_SCENE_TEMPLATES = ['battle', 'success', 'transition'] as const;
export type CutInSceneTemplate = (typeof CUT_IN_SCENE_TEMPLATES)[number];

/** Builds an editable, asset-free example using the ordinary scene and layer fields. */
export function createCutInSceneTemplate(kind: CutInSceneTemplate, title: string): CutIn {
  const cutIn = new CutIn();
  cutIn.name = title;
  cutIn.width = 640;
  cutIn.height = 360;
  cutIn.originalSize = false;
  cutIn.imageIdentifier = '';
  cutIn.initialize();

  const scene = ensureScene(cutIn);
  scene.durationMs = kind === 'transition' ? 2400 : 3000;
  scene.backgroundColor = kind === 'success' ? '#102b27' : kind === 'transition' ? '#111827' : '#24131b';

  const band = addLayer(scene, 'fill', title, cutIn);
  band.x = 0;
  band.y = kind === 'transition' ? 135 : 110;
  band.width = cutIn.width;
  band.height = kind === 'transition' ? 90 : 140;
  band.fillFrom = kind === 'success' ? '#145a4c' : kind === 'transition' ? '#273449' : '#782837';
  band.fillTo = kind === 'success' ? '#193b56' : kind === 'transition' ? '#303b53' : '#352252';
  band.opacity = 0.9;

  const words = addLayer(scene, 'text', title, cutIn);
  words.text = title;
  words.x = 32;
  words.y = kind === 'transition' ? 135 : 110;
  words.width = cutIn.width - 64;
  words.height = kind === 'transition' ? 90 : 140;
  words.fontSizePx = kind === 'transition' ? 42 : 54;
  words.strokeColor = '#10121c';
  words.strokeWidthPx = 2;
  applyLayerPreset(
    words,
    kind === 'battle' ? 'impact' : kind === 'success' ? 'reveal' : 'headline',
    cutIn,
    scene.durationMs
  );
  return cutIn;
}
