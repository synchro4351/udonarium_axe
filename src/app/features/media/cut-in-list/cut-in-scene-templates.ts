import { CutIn } from '@axe/domain/media/cut-in';
import type { CutInClip } from '@axe/domain/media/cut-in-clip';
import type { CutInFillShape } from '@axe/domain/media/cut-in-fill';
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
  clip?: CutInClip;
  shape?: CutInFillShape;
  layout?: 'stamp' | 'burst';
}

const LOOKS: Record<CutInSceneTemplate, TemplateLook> = {
  battle: {
    durationMs: 1600,
    bandFrom: '#782837',
    bandTo: '#352252',
    preset: 'impact',
    clip: 'gash',
    shape: 'speedlines',
  },
  success: {
    durationMs: 1500,
    bandFrom: '#145a4c',
    bandTo: '#193b56',
    preset: 'reveal',
    clip: 'slant',
    shape: 'radial',
  },
  transition: {
    durationMs: 2600,
    bandFrom: '#273449',
    bandTo: '#303b53',
    preset: 'headline',
    clip: 'slantBack',
    shape: 'stripes',
  },
  like: {
    durationMs: 1000,
    bandFrom: '#205cc8',
    bandTo: '#4e8cec',
    preset: 'impact',
    clip: 'circle',
    shape: 'radial',
    layout: 'stamp',
  },
  bouquet: {
    durationMs: 2400,
    bandFrom: '#ad426d',
    bandTo: '#e08ab3',
    preset: 'drifting',
    clip: 'circle',
    shape: 'radial',
    layout: 'stamp',
  },
  heart: {
    durationMs: 1500,
    bandFrom: '#ba2e58',
    bandTo: '#e36c88',
    preset: 'reveal',
    clip: 'circle',
    shape: 'radial',
    layout: 'stamp',
  },
  shock: {
    durationMs: 1000,
    bandFrom: '#373a5e',
    bandTo: '#6b568e',
    preset: 'alarm',
    clip: 'burst',
    shape: 'conic',
    layout: 'burst',
  },
  critical: {
    durationMs: 1200,
    bandFrom: '#aa4215',
    bandTo: '#e7aa30',
    preset: 'impact',
    clip: 'gash',
    shape: 'speedlines',
  },
  fumble: {
    durationMs: 1200,
    bandFrom: '#3c4260',
    bandTo: '#765288',
    preset: 'alarm',
    clip: 'torn',
    shape: 'halftone',
  },
  victory: {
    durationMs: 2200,
    bandFrom: '#a26b16',
    bandTo: '#d9b553',
    preset: 'entrance',
    clip: 'star',
    shape: 'radial',
    layout: 'burst',
  },
  sanCheck: {
    durationMs: 1800,
    bandFrom: '#304364',
    bandTo: '#665188',
    preset: 'ominous',
    clip: 'torn',
    shape: 'halftone',
  },
  levelUp: {
    durationMs: 1500,
    bandFrom: '#326b30',
    bandTo: '#85ac3f',
    preset: 'entrance',
    clip: 'chevron',
    shape: 'linear',
  },
  questClear: {
    durationMs: 2600,
    bandFrom: '#165e76',
    bandTo: '#43a69a',
    preset: 'reveal',
    clip: 'star',
    shape: 'radial',
    layout: 'burst',
  },
  rebuttal: {
    durationMs: 1000,
    bandFrom: '#a7182b',
    bandTo: '#d84a36',
    preset: 'headline',
    clip: 'gash',
    shape: 'speedlines',
  },
  ending: {
    durationMs: 3000,
    bandFrom: '#394c70',
    bandTo: '#8a7897',
    preset: 'whisper',
    clip: 'circle',
    shape: 'radial',
    layout: 'stamp',
  },
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
  band.x = look.layout === 'stamp' ? 205 : look.layout === 'burst' ? 105 : 40;
  band.y = look.layout === 'stamp' ? 65 : look.layout === 'burst' ? 60 : 115;
  band.width = look.layout === 'stamp' ? 230 : look.layout === 'burst' ? 430 : cutIn.width - 80;
  band.height = look.layout === 'stamp' ? 230 : look.layout === 'burst' ? 240 : 130;
  band.clip = look.clip ?? 'none';
  band.fillShape = look.shape ?? 'linear';
  band.fillFrom = look.bandFrom;
  band.fillTo = look.bandTo;
  band.opacity = 0.82;

  const words = addLayer(scene, 'text', title, cutIn);
  words.text = title;
  words.x = look.layout === 'stamp' ? 210 : 48;
  words.y = look.layout === 'stamp' ? 110 : 125;
  words.width = look.layout === 'stamp' ? 220 : cutIn.width - 96;
  words.height = look.layout === 'stamp' ? 140 : 110;
  words.fontSizePx = look.layout === 'stamp' ? 42 : title.length > 12 ? 42 : 54;
  words.strokeColor = '#10121c';
  words.strokeWidthPx = 2;
  applyLayerPreset(words, look.preset, cutIn, scene.durationMs);
  return cutIn;
}
