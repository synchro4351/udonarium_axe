import { CutIn } from '@axe/domain/media/cut-in';
import { applyLayerPreset } from '@axe/domain/media/cut-in-layer-presets';
import { addLayer, ensureScene } from '@axe/features/media/cut-in-editor/cut-in-editor-ops';

export const CUT_IN_SCENE_TEMPLATES = [
  'battle',
  'success',
  'transition',
  'like',
  'bouquet',
  'heart',
  'shock',
  'critical',
  'fumble',
  'victory',
  'sanCheck',
  'levelUp',
  'questClear',
  'rebuttal',
  'ending',
] as const;
export type CutInSceneTemplate = (typeof CUT_IN_SCENE_TEMPLATES)[number];

interface TemplateLook {
  durationMs: number;
  bandFrom: string;
  bandTo: string;
  preset: string;
}

const LOOKS: Record<CutInSceneTemplate, TemplateLook> = {
  battle: { durationMs: 1600, bandFrom: '#782837', bandTo: '#352252', preset: 'impact' },
  success: { durationMs: 1500, bandFrom: '#145a4c', bandTo: '#193b56', preset: 'reveal' },
  transition: { durationMs: 2600, bandFrom: '#273449', bandTo: '#303b53', preset: 'headline' },
  like: { durationMs: 1000, bandFrom: '#205cc8', bandTo: '#4e8cec', preset: 'impact' },
  bouquet: { durationMs: 2400, bandFrom: '#ad426d', bandTo: '#e08ab3', preset: 'drifting' },
  heart: { durationMs: 1500, bandFrom: '#ba2e58', bandTo: '#e36c88', preset: 'reveal' },
  shock: { durationMs: 1000, bandFrom: '#373a5e', bandTo: '#6b568e', preset: 'alarm' },
  critical: { durationMs: 1200, bandFrom: '#aa4215', bandTo: '#e7aa30', preset: 'impact' },
  fumble: { durationMs: 1200, bandFrom: '#3c4260', bandTo: '#765288', preset: 'alarm' },
  victory: { durationMs: 2200, bandFrom: '#a26b16', bandTo: '#d9b553', preset: 'entrance' },
  sanCheck: { durationMs: 1800, bandFrom: '#304364', bandTo: '#665188', preset: 'ominous' },
  levelUp: { durationMs: 1500, bandFrom: '#326b30', bandTo: '#85ac3f', preset: 'entrance' },
  questClear: { durationMs: 2600, bandFrom: '#165e76', bandTo: '#43a69a', preset: 'reveal' },
  rebuttal: { durationMs: 1000, bandFrom: '#a7182b', bandTo: '#d84a36', preset: 'headline' },
  ending: { durationMs: 3000, bandFrom: '#394c70', bandTo: '#8a7897', preset: 'whisper' },
};

/** Builds an editable, asset-free example using the ordinary scene and layer fields. */
export function createCutInSceneTemplate(kind: CutInSceneTemplate, title: string): CutIn {
  const look = LOOKS[kind];
  const cutIn = new CutIn();
  cutIn.name = title;
  cutIn.width = 640;
  cutIn.height = 360;
  cutIn.originalSize = false;
  cutIn.imageIdentifier = '';
  cutIn.initialize();

  const scene = ensureScene(cutIn);
  scene.durationMs = look.durationMs;
  scene.backgroundColor = '';

  const band = addLayer(scene, 'fill', title, cutIn);
  band.x = 40;
  band.y = 115;
  band.width = cutIn.width - 80;
  band.height = 130;
  band.fillFrom = look.bandFrom;
  band.fillTo = look.bandTo;
  band.opacity = 0.82;

  const words = addLayer(scene, 'text', title, cutIn);
  words.text = title;
  words.x = 48;
  words.y = 125;
  words.width = cutIn.width - 96;
  words.height = 110;
  words.fontSizePx = title.length > 12 ? 42 : 54;
  words.strokeColor = '#10121c';
  words.strokeWidthPx = 2;
  applyLayerPreset(words, look.preset, cutIn, scene.durationMs);
  return cutIn;
}
