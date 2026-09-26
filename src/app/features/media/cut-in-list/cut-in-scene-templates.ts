import type { CutInEasingName } from '@axe/domain/media/cubic-bezier';
import { CutIn } from '@axe/domain/media/cut-in';
import { clipPoints, type CutInClip } from '@axe/domain/media/cut-in-clip';
import type { CutInFillShape } from '@axe/domain/media/cut-in-fill';
import { type CutInTrackName, encodeCutInTracks, upsertKey } from '@axe/domain/media/cut-in-keyframe';
import type { CutInLayer } from '@axe/domain/media/cut-in-layer';
import type { CutInScene } from '@axe/domain/media/cut-in-scene';
import { addLayer, ensureScene } from '@axe/features/media/cut-in-editor/cut-in-editor-ops';
import { CUT_IN_FONT_OPTIONS } from '@axe/features/media/cut-in-editor/cut-in-font-options';

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

/**
 * Examples are built from ordinary layers and keys only, so everything they do can be
 * seen, retimed or thrown away in the editor, and a room that already has cut-ins sees
 * nothing new but the one just made.
 */

interface Stage {
  width: number;
  height: number;
  durationMs: number;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

type FontName = (typeof CUT_IN_FONT_OPTIONS)[number]['name'];

interface BandLook extends Box {
  clip: CutInClip;
  shape: CutInFillShape;
  from: string;
  to?: string;
  angleDeg?: number;
  scalePx?: number;
  opacity?: number;
  rotation?: number;
  skewXDeg?: number;
  anchorX?: number;
  blendMode?: string;
}

interface LetterLook {
  box: Box;
  sizePx: number;
  font: FontName;
  weight?: number;
  color?: string;
  stroke?: string;
  /** Whether each word, or each letter of a short word, becomes a layer of its own. */
  split?: boolean;
  rotation?: number;
  skewXDeg?: number;
  letterSpacingPx?: number;
}

/** Where a layer is at one end of a move, as offsets from where it rests. Anything left out is its rest. */
interface Pose {
  dx?: number;
  dy?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  turn?: number;
  opacity?: number;
  blur?: number;
  wipe?: number;
  crumble?: number;
}

type Key = readonly [ms: number, value: number, easing?: CutInEasingName];

interface TemplatePlan {
  stage: Stage;
  build(scene: CutInScene, stage: Stage, text: string): void;
}

const PLANS: Record<CutInSceneTemplate, TemplatePlan> = {
  battle: {
    stage: { width: 720, height: 300, durationMs: 1200 },
    build(scene, stage, text) {
      const slash = band(scene, stage, 'band', {
        x: -40,
        y: 70,
        width: 800,
        height: 160,
        rotation: -4,
        opacity: 0.9,
        clip: 'gash',
        shape: 'speedlines',
        from: '#782837',
        to: '#352252',
      });
      slash.wipeShape = 'chevronRight';
      arrive(slash, 0, 260, { wipe: 0 });
      leave(slash, stage.durationMs, 200, { dx: 800, opacity: 0 });

      const edge = band(scene, stage, 'edge', {
        x: -40,
        y: 222,
        width: 800,
        height: 12,
        rotation: -4,
        clip: 'none',
        shape: 'linear',
        from: '#ffcf4a',
        to: '#ff5a36',
        angleDeg: 0,
      });
      arrive(edge, 80, 260, { dx: -800 });
      leave(edge, stage.durationMs, 180, { dx: 800 });

      lettering(scene, stage, text, {
        box: { x: 60, y: 85, width: 600, height: 130 },
        sizePx: 88,
        font: 'gothic',
        weight: 900,
        split: true,
      }).forEach((letter, at) => {
        arrive(letter, 140 + at * 60, 200, { scale: 2.6, turn: -10, opacity: 0 }, 'outBack');
        leave(letter, stage.durationMs, 180, { dx: 260, opacity: 0 });
      });
    },
  },
  success: {
    stage: { width: 560, height: 320, durationMs: 1500 },
    build(scene, stage, text) {
      const base = band(scene, stage, 'band', {
        x: 30,
        y: 90,
        width: 500,
        height: 140,
        anchorX: 0,
        opacity: 0.85,
        clip: 'slant',
        shape: 'radial',
        from: '#145a4c',
        to: '#193b56',
      });
      arrive(base, 0, 300, { scaleX: 0 });
      leave(base, stage.durationMs, 220, { dy: -20, opacity: 0 });

      // The glint lies over the band on the same box and outline, so none of it shows past the
      // band's edges; its leading edge is let in and its trailing edge taken away just behind.
      const glint = band(scene, stage, 'glint', {
        x: 30,
        y: 90,
        width: 500,
        height: 140,
        opacity: 0.4,
        blendMode: 'screen',
        clip: 'slant',
        shape: 'stripes',
        from: '#ffffff',
        to: '#9ef0d0',
        angleDeg: 117,
        scalePx: 16,
      });
      glint.wipeShape = 'right';
      glint.crumbleShape = 'left';
      tween(glint, 320, 1000, { wipe: 0 }, { wipe: 1 }, 'linear');
      tween(glint, 460, 1140, { crumble: 1 }, { crumble: 0 }, 'linear');

      lettering(scene, stage, text, {
        box: { x: 40, y: 100, width: 480, height: 120 },
        sizePx: 72,
        font: 'rounded',
        weight: 800,
        split: true,
      }).forEach((letter, at) => {
        arrive(letter, 120 + at * 70, 300, { dy: 40, scale: 0.6, opacity: 0 }, 'outBack');
        leave(letter, stage.durationMs, 220, { scale: 1.3, opacity: 0 });
      });
    },
  },
  transition: {
    stage: { width: 800, height: 200, durationMs: 2600 },
    build(scene, stage, text) {
      const stripe = band(scene, stage, 'band', {
        x: 0,
        y: 40,
        width: 800,
        height: 120,
        opacity: 0.9,
        clip: 'slantBack',
        shape: 'stripes',
        from: '#273449',
        to: '#303b53',
      });
      stripe.wipeShape = 'right';
      stripe.crumbleShape = 'crumbleRight';
      arrive(stripe, 0, 500, { wipe: 0 }, 'inOutCubic');
      leave(stripe, stage.durationMs, 450, { crumble: 0 }, 'inOutCubic');

      const line = band(scene, stage, 'line', {
        x: 0,
        y: 150,
        width: 800,
        height: 4,
        anchorX: 0,
        clip: 'none',
        shape: 'linear',
        from: '#9fb6e8',
      });
      arrive(line, 200, 800, { scaleX: 0 }, 'inOutCubic');
      leave(line, stage.durationMs, 500, { scaleX: 0 });

      lettering(scene, stage, text, {
        box: { x: 60, y: 50, width: 680, height: 100 },
        sizePx: 64,
        font: 'mincho',
        weight: 600,
        split: true,
        letterSpacingPx: 4,
      }).forEach((letter, at) => {
        arrive(letter, 300 + at * 90, 500, { dx: -40, blur: 6, opacity: 0 });
        leave(letter, stage.durationMs, 500, { dx: 40, blur: 6, opacity: 0 });
      });
    },
  },
  like: {
    stage: { width: 360, height: 360, durationMs: 1000 },
    build(scene, stage, text) {
      const burst = band(scene, stage, 'burst', {
        x: 40,
        y: 40,
        width: 280,
        height: 280,
        opacity: 0.6,
        clip: 'burst',
        shape: 'conic',
        from: '#8fc0ff',
        to: '#205cc8',
      });
      arrive(burst, 60, 240, { scale: 0 });
      tween(burst, 0, stage.durationMs, {}, { turn: 90 }, 'linear');
      leave(burst, stage.durationMs, 200, { scale: 1.4, opacity: 0 });

      const circle = band(scene, stage, 'circle', {
        x: 70,
        y: 70,
        width: 220,
        height: 220,
        clip: 'circle',
        shape: 'radial',
        from: '#205cc8',
        to: '#4e8cec',
      });
      arrive(circle, 0, 260, { scale: 0, turn: -30 }, 'outBack');
      leave(circle, stage.durationMs, 200, { scale: 1.35, opacity: 0 });

      lettering(scene, stage, text, {
        box: { x: 70, y: 130, width: 220, height: 100 },
        sizePx: 60,
        font: 'rounded',
        weight: 900,
        split: true,
      }).forEach((letter, at) => {
        arrive(letter, 140 + at * 50, 220, { dy: -30, opacity: 0 }, 'outBack');
        leave(letter, stage.durationMs, 180, { dy: -40, opacity: 0 });
      });
    },
  },
  bouquet: {
    stage: { width: 400, height: 400, durationMs: 2400 },
    build: (scene, stage, text) => bloom(scene, stage, text, { circle: 220, glyph: 200 }),
  },
  heart: {
    stage: { width: 260, height: 260, durationMs: 1200 },
    build: (scene, stage, text) => heartbeat(scene, stage, text, { circle: 120, glyph: 150 }),
  },
  shock: {
    stage: { width: 440, height: 440, durationMs: 1000 },
    build(scene, stage, text) {
      // Streaks across the whole width, each falling from above the stage to below it in turn.
      const streaks = [
        { x: 24, height: 150, atMs: 0 },
        { x: 78, height: 110, atMs: 240 },
        { x: 131, height: 170, atMs: 90 },
        { x: 183, height: 130, atMs: 380 },
        { x: 247, height: 160, atMs: 160 },
        { x: 300, height: 120, atMs: 300 },
        { x: 356, height: 140, atMs: 40 },
        { x: 410, height: 110, atMs: 450 },
      ];
      for (const streak of streaks) {
        const rain = band(scene, stage, 'rain', {
          x: streak.x,
          y: 0,
          width: 4,
          height: streak.height,
          opacity: 0.6,
          clip: 'none',
          shape: 'linear',
          from: '#373a5e',
          to: '#d8d0ff',
          angleDeg: 180,
        });
        tween(rain, streak.atMs, streak.atMs + 520, { dy: -streak.height }, { dy: stage.height }, 'linear');
      }

      const burst = band(scene, stage, 'band', {
        x: 50,
        y: 50,
        width: 340,
        height: 340,
        opacity: 0.9,
        clip: 'burst',
        shape: 'conic',
        from: '#373a5e',
        to: '#6b568e',
      });
      arrive(burst, 0, 180, { dy: -440 }, 'outBack');
      leave(burst, stage.durationMs, 180, { dy: 440 });

      lettering(scene, stage, text, {
        box: { x: 70, y: 160, width: 300, height: 120 },
        sizePx: 80,
        font: 'gothic',
        weight: 900,
        color: '#f4f0ff',
        split: true,
      }).forEach((letter, at) => {
        letter.effect = 'shake';
        arrive(letter, 60 + at * 50, 180, { dy: -300, opacity: 0 }, 'outBack');
        leave(letter, stage.durationMs, 180, { dy: 360 });
      });
    },
  },
  critical: {
    stage: { width: 680, height: 280, durationMs: 1200 },
    build(scene, stage, text) {
      const slash = band(scene, stage, 'band', {
        x: -20,
        y: 60,
        width: 720,
        height: 160,
        skewXDeg: -14,
        anchorX: 0,
        opacity: 0.9,
        clip: 'gash',
        shape: 'speedlines',
        from: '#aa4215',
        to: '#e7aa30',
      });
      arrive(slash, 0, 220, { scaleX: 0 });
      leave(slash, stage.durationMs, 200, { scaleY: 0, opacity: 0 });

      const gleam = band(scene, stage, 'gleam', {
        x: -100,
        y: 40,
        width: 900,
        height: 10,
        rotation: -8,
        clip: 'none',
        shape: 'linear',
        from: '#fff1a8',
        to: '#e7aa30',
        angleDeg: 0,
      });
      arrive(gleam, 60, 340, { dx: -900 });
      leave(gleam, stage.durationMs, 200, { dx: 900 });

      lettering(scene, stage, text, {
        box: { x: 40, y: 80, width: 600, height: 120 },
        sizePx: 84,
        font: 'gothic',
        weight: 900,
        color: '#fffbe8',
        skewXDeg: -12,
        split: true,
      }).forEach((letter, at) => {
        arrive(letter, 120 + at * 40, 160, { scale: 2, opacity: 0 }, 'outBack');
        leave(letter, stage.durationMs, 220, { scale: 1.6, opacity: 0 });
      });
    },
  },
  fumble: {
    stage: { width: 560, height: 320, durationMs: 1200 },
    build(scene, stage, text) {
      const torn = band(scene, stage, 'band', {
        x: 30,
        y: 90,
        width: 500,
        height: 140,
        opacity: 0.85,
        clip: 'torn',
        shape: 'halftone',
        from: '#3c4260',
        to: '#765288',
      });
      torn.crumbleShape = 'crumbleLeft';
      arrive(torn, 0, 200, { dy: -20, opacity: 0 });
      leave(torn, stage.durationMs, 300, { crumble: 0 });

      lettering(scene, stage, text, {
        box: { x: 50, y: 100, width: 460, height: 120 },
        sizePx: 76,
        font: 'monospace',
        weight: 700,
        split: true,
      }).forEach((letter, at) => {
        const lean = at % 2 === 0 ? 1 : -1;
        arrive(letter, 100 + at * 40, 200, { dy: -60, opacity: 0 }, 'outBack');
        animate(letter, {
          rotation: [
            [500, 0, 'inOutQuad'],
            [620, 8 * lean, 'inOutQuad'],
            [740, 0],
          ],
        });
        leave(letter, stage.durationMs, 260, { dy: 220, turn: 25 * lean });
      });
    },
  },
  victory: {
    stage: { width: 640, height: 360, durationMs: 1800 },
    build(scene, stage, text) {
      const ribbon = band(scene, stage, 'ribbon', {
        x: 40,
        y: 140,
        width: 560,
        height: 100,
        clip: 'slant',
        shape: 'linear',
        from: '#7a1f1f',
        to: '#c23b3b',
        angleDeg: 0,
      });
      ribbon.wipeShape = 'right';
      arrive(ribbon, 0, 300, { wipe: 0 });
      leave(ribbon, stage.durationMs, 250, { dy: -40, opacity: 0 });

      // Three stars across the ribbon, rolling in from the left one after another.
      for (const [at, centerX] of [150, 320, 490].entries()) {
        const star = band(scene, stage, 'star', {
          x: centerX - 75,
          y: 115,
          width: 150,
          height: 150,
          opacity: 0.9,
          clip: 'star',
          shape: 'radial',
          from: '#d9b553',
          to: '#a26b16',
        });
        const landedMs = 100 + at * 120 + 420;
        arrive(star, landedMs - 420, 420, { dx: -160, turn: -270, scale: 0.3, opacity: 0 }, 'outBack');
        tween(star, landedMs, stage.durationMs - 280, {}, { turn: 20 }, 'linear');
        leave(star, stage.durationMs, 280, { dy: -60, opacity: 0 });
      }

      lettering(scene, stage, text, {
        box: { x: 40, y: 130, width: 560, height: 120 },
        sizePx: 96,
        font: 'mincho',
        weight: 900,
        color: '#fff6d0',
        stroke: '#5a3a00',
        split: true,
      }).forEach((letter, at) => {
        arrive(letter, 400 + at * 70, 320, { dy: 50, scale: 0.4, opacity: 0 }, 'outBack');
        leave(letter, stage.durationMs, 280, { dy: -80, scale: 1.2, opacity: 0 });
      });
    },
  },
  sanCheck: {
    stage: { width: 600, height: 340, durationMs: 2400 },
    build(scene, stage, text) {
      const torn = band(scene, stage, 'band', {
        x: 40,
        y: 90,
        width: 520,
        height: 160,
        opacity: 0.85,
        clip: 'tornLeft',
        shape: 'halftone',
        from: '#304364',
        to: '#665188',
      });
      torn.effect = 'pulse';
      arrive(torn, 0, 700, { scale: 1.1, blur: 8, opacity: 0 }, 'inOutQuad');
      leave(torn, stage.durationMs, 700, { blur: 8, opacity: 0 });

      lettering(scene, stage, text, {
        box: { x: 60, y: 110, width: 480, height: 120 },
        sizePx: 72,
        font: 'mincho',
        weight: 700,
        color: '#e6ddff',
        split: true,
        letterSpacingPx: 6,
      }).forEach((letter, at) => {
        arrive(letter, 200 + at * 120, 600, { dy: 12, blur: 10, opacity: 0 }, 'inOutQuad');
        leave(letter, stage.durationMs, 600, { blur: 10, opacity: 0 });
      });
    },
  },
  levelUp: {
    stage: { width: 600, height: 340, durationMs: 1400 },
    build(scene, stage, text) {
      // An arrow of two layers: a head over a shaft wide enough to carry the words.
      const head: Box = { x: 50, y: 14, width: 500, height: 170 };
      // A paler head behind, which surges up and away once the arrow has landed.
      const spark = arrowHead(scene, stage, 'spark', head, { from: '#d8f59a', opacity: 0.6 });
      arrive(spark, 120, 300, { dy: 60, opacity: 0 });
      tween(spark, 500, 900, {}, { dy: -50, scale: 1.1, opacity: 0 }, 'outCubic');

      // The shaft reaches a little way up under the head, so no seam shows between them.
      const shaft = band(scene, stage, 'band', {
        x: 100,
        y: head.y + head.height - 2,
        width: 400,
        height: 144,
        clip: 'none',
        shape: 'linear',
        from: '#85ac3f',
        to: '#326b30',
        angleDeg: 180,
      });
      const tip = arrowHead(scene, stage, 'head', head, { from: '#85ac3f' });
      for (const part of [shaft, tip]) {
        arrive(part, 0, 260, { dy: 120, opacity: 0 }, 'outBack');
        leave(part, stage.durationMs, 240, { dy: -160, opacity: 0 });
      }

      // The words sit in the shaft, below the head.
      lettering(scene, stage, text, {
        box: { x: 110, y: 190, width: 380, height: 120 },
        sizePx: 80,
        font: 'rounded',
        weight: 900,
        split: true,
      }).forEach((letter, at) => {
        arrive(letter, 120 + at * 120, 260, { dy: 60, scale: 0.6, opacity: 0 }, 'outBack');
        leave(letter, stage.durationMs, 220, { dy: -140, scale: 1.2, opacity: 0 });
      });
    },
  },
  questClear: {
    stage: { width: 720, height: 360, durationMs: 2600 },
    build(scene, stage, text) {
      const star = band(scene, stage, 'star', {
        x: 230,
        y: 50,
        width: 260,
        height: 260,
        opacity: 0.9,
        clip: 'star',
        shape: 'radial',
        from: '#165e76',
        to: '#43a69a',
      });
      arrive(star, 0, 500, { scale: 0, turn: -90 }, 'outBack');
      tween(star, 500, stage.durationMs - 400, {}, { turn: 25 }, 'linear');
      leave(star, stage.durationMs, 400, { scale: 1.4, opacity: 0 });

      const ribbon = band(scene, stage, 'ribbon', {
        x: 0,
        y: 135,
        width: 720,
        height: 90,
        opacity: 0.9,
        clip: 'none',
        shape: 'stripes',
        from: '#0f3f52',
        to: '#2c8f86',
        angleDeg: 45,
      });
      ribbon.wipeShape = 'right';
      ribbon.crumbleShape = 'crumbleRight';
      arrive(ribbon, 200, 500, { wipe: 0 }, 'inOutCubic');
      leave(ribbon, stage.durationMs, 400, { crumble: 0 });

      lettering(scene, stage, text, {
        box: { x: 60, y: 125, width: 600, height: 110 },
        sizePx: 80,
        font: 'mincho',
        weight: 800,
        split: true,
      }).forEach((letter, at) => {
        arrive(letter, 400 + at * 150, 450, { dx: -30, blur: 4, opacity: 0 });
        leave(letter, stage.durationMs, 400, { dy: -30, opacity: 0 });
      });
    },
  },
  rebuttal: {
    stage: { width: 640, height: 300, durationMs: 1000 },
    build(scene, stage, text) {
      const slash = band(scene, stage, 'band', {
        x: -20,
        y: 80,
        width: 680,
        height: 140,
        rotation: -8,
        opacity: 0.9,
        clip: 'gash',
        shape: 'speedlines',
        from: '#a7182b',
        to: '#d84a36',
      });
      arrive(slash, 0, 160, { dx: -500, dy: 120 });
      leave(slash, stage.durationMs, 160, { dx: 500, dy: -120 });

      const flash = band(scene, stage, 'flash', {
        x: -40,
        y: 70,
        width: 720,
        height: 8,
        rotation: -8,
        opacity: 0.8,
        clip: 'none',
        shape: 'linear',
        from: '#ffffff',
      });
      arrive(flash, 40, 180, { dx: 700, dy: -100 });
      leave(flash, stage.durationMs, 140, { dx: -700, dy: 100 });

      // A second flash under the band, crossing the other way.
      const under = band(scene, stage, 'flash', {
        x: -40,
        y: 222,
        width: 720,
        height: 8,
        rotation: -8,
        opacity: 0.8,
        clip: 'none',
        shape: 'linear',
        from: '#ffffff',
      });
      arrive(under, 40, 180, { dx: -700, dy: 100 });
      leave(under, stage.durationMs, 140, { dx: 700, dy: -100 });

      lettering(scene, stage, text, {
        box: { x: 40, y: 90, width: 560, height: 120 },
        sizePx: 96,
        font: 'gothic',
        weight: 900,
        rotation: -8,
        skewXDeg: -10,
        split: true,
      }).forEach((letter, at) => {
        arrive(letter, 100 + at * 50, 160, { dx: 260, dy: -80, scale: 1.8, opacity: 0 });
        leave(letter, stage.durationMs, 160, { dx: -260, dy: 80, opacity: 0 });
      });
    },
  },
  ending: {
    stage: { width: 720, height: 320, durationMs: 4200 },
    build(scene, stage, text) {
      const glow = band(scene, stage, 'glow', {
        x: 210,
        y: 10,
        width: 300,
        height: 300,
        opacity: 0.55,
        clip: 'circle',
        shape: 'radial',
        from: '#394c70',
        to: '#8a7897',
      });
      arrive(glow, 0, 1600, { scale: 0.85, opacity: 0 }, 'inOutQuad');
      leave(glow, stage.durationMs, 1600, { scale: 1.1, opacity: 0 }, 'inOutQuad');

      const line = band(scene, stage, 'line', {
        x: 160,
        y: 222,
        width: 400,
        height: 2,
        clip: 'none',
        shape: 'linear',
        from: '#f0e6ff',
      });
      arrive(line, 500, 1400, { scaleX: 0 }, 'inOutCubic');
      leave(line, stage.durationMs, 1400, { scaleX: 0 }, 'inOutCubic');

      lettering(scene, stage, text, {
        box: { x: 60, y: 100, width: 600, height: 110 },
        sizePx: 60,
        font: 'mincho',
        weight: 400,
        color: '#f6f1ff',
        stroke: '',
        split: true,
        letterSpacingPx: 10,
      }).forEach((letter, at) => {
        arrive(letter, 400 + at * 180, 1200, { dy: 10, blur: 6, opacity: 0 }, 'inOutQuad');
        leave(letter, stage.durationMs, 1400, { dy: -10, blur: 6, opacity: 0 }, 'inOutQuad');
      });
    },
  },
};

/** Builds an editable, asset-free example using the ordinary scene and layer fields. */
export function createCutInSceneTemplate(kind: CutInSceneTemplate, title: string): CutIn {
  const plan = PLANS[kind];
  const cutIn = new CutIn();
  cutIn.name = title;
  cutIn.width = plan.stage.width;
  cutIn.height = plan.stage.height;
  cutIn.originalSize = false;
  cutIn.frameless = true;
  cutIn.imageIdentifier = '';
  cutIn.initialize();

  const scene = ensureScene(cutIn);
  scene.durationMs = plan.stage.durationMs;
  scene.backgroundColor = '';
  plan.build(scene, plan.stage, title);
  return cutIn;
}

/**
 * The pieces a title is let in by: its words, or the letters of one short word, or the whole
 * of it where splitting would only make it harder to edit.
 */
export function textFragments(text: string): string[] {
  const whole = text.trim();
  if (whole.length < 1) return [text];

  const words = whole.split(/\s+/);
  if (words.length > 1) return words.length <= 4 ? words : [whole];

  const letters = graphemes(whole);
  return letters.length >= 2 && letters.length <= 10 ? letters : [whole];
}

/** What a reader counts as letters, so joined emoji and marks are never cut apart. */
function graphemes(text: string): string[] {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return Array.from(text);
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment);
}

/** How much wider than its estimated width a piece's box is, as a share of the size of the letters. */
const FRAGMENT_ROOM_EM = 0.5;

/** A glyph's width as a share of the size of the letters, near enough to lay pieces side by side. */
function emWidth(fragment: string): number {
  let width = 0;
  for (const letter of fragment) {
    const code = letter.codePointAt(0) ?? 0;
    if (code >= 0x2e80) width += 1;
    else if (letter === ' ') width += 0.3;
    else if (/[A-Z]/.test(letter)) width += 0.72;
    else width += 0.6;
  }
  return Math.max(0.5, width);
}

function band(scene: CutInScene, stage: Stage, name: string, look: BandLook): CutInLayer {
  const layer = addLayer(scene, 'fill', name, stage);
  place(layer, look);
  layer.clip = look.clip;
  layer.fillShape = look.shape;
  layer.fillFrom = look.from;
  layer.fillTo = look.to ?? '';
  if (look.angleDeg !== undefined) layer.fillAngleDeg = look.angleDeg;
  if (look.scalePx !== undefined) layer.fillScalePx = look.scalePx;
  layer.opacity = look.opacity ?? 1;
  layer.rotation = look.rotation ?? 0;
  layer.skewXDeg = look.skewXDeg ?? 0;
  layer.anchorX = look.anchorX ?? 0.5;
  layer.blendMode = look.blendMode ?? '';
  return layer;
}

/** How much of a chevron's length its pointed end takes up: a triangle of its own. */
const CHEVRON_POINT = 1 - Math.max(...clipPoints('chevron').map(([x, y]) => (y === 0 ? x : 0)));

/**
 * A triangle pointing up, filling the box from its point at the top to its base across the bottom.
 *
 * It is the pointed end of a chevron, turned a quarter back so its point faces up and let in
 * only as far as its shoulders, so a copy of the app that knows nothing newer draws it the same.
 */
function arrowHead(
  scene: CutInScene,
  stage: Stage,
  name: string,
  box: Box,
  look: { from: string; opacity?: number }
): CutInLayer {
  // Turned, the chevron's length runs up the stage and its height across it, and it turns about
  // its middle, which lies below the base of the triangle.
  const length = Math.round(box.height / CHEVRON_POINT);
  const middleY = box.y + box.height + (0.5 - CHEVRON_POINT) * length;
  const layer = band(scene, stage, name, {
    x: Math.round(box.x + (box.width - length) / 2),
    y: Math.round(middleY - box.width / 2),
    width: length,
    height: box.width,
    rotation: -90,
    clip: 'chevron',
    shape: 'linear',
    ...look,
  });
  layer.wipeShape = 'left';
  layer.wipe = CHEVRON_POINT;
  return layer;
}

/** Lays the words into the box, as one layer or one per piece set side by side. */
function lettering(scene: CutInScene, stage: Stage, text: string, look: LetterLook): CutInLayer[] {
  const fragments = look.split ? textFragments(text) : [text];
  const gapEm = fragments.length > 1 && /\s/.test(text.trim()) ? 0.3 : 0.04;
  const widths = fragments.map(emWidth);
  const totalEm = widths.reduce((sum, width) => sum + width, 0) + gapEm * (fragments.length - 1);
  const sizePx = Math.max(
    20,
    Math.round(Math.min(look.sizePx, (look.box.width * 0.92) / totalEm, look.box.height * 0.85))
  );

  const font = CUT_IN_FONT_OPTIONS.find((option) => option.name === look.font)?.value ?? '';
  const totalPx = fragments.length > 1 ? totalEm * sizePx : look.box.width;
  let x = look.box.x + (look.box.width - totalPx) / 2;
  // Pieces of turned words sit along the same slope, rather than each turning on a level line.
  const slope = Math.tan(((look.rotation ?? 0) * Math.PI) / 180);
  const middle = look.box.x + look.box.width / 2;

  return fragments.map((fragment, at) => {
    const layer = addLayer(scene, 'text', fragment, stage);
    const slot = fragments.length > 1 ? widths[at] * sizePx : look.box.width;
    // The widths above are only estimates, so a piece is given room to spare on both sides of
    // its slot rather than a box it could overrun and break inside.
    const width = fragments.length > 1 ? slot + FRAGMENT_ROOM_EM * sizePx : slot;
    const lift = (x + slot / 2 - middle) * slope;
    place(layer, {
      x: Math.round(x - (width - slot) / 2),
      y: Math.round(look.box.y + lift),
      width: Math.round(width),
      height: look.box.height,
    });
    x += slot + gapEm * sizePx;

    layer.text = fragment;
    layer.fontSizePx = sizePx;
    layer.fontFamily = font;
    layer.fontWeight = look.weight ?? 700;
    layer.color = look.color ?? '#ffffff';
    layer.strokeColor = look.stroke ?? '#10121c';
    layer.strokeWidthPx = layer.strokeColor ? 3 : 0;
    layer.rotation = look.rotation ?? 0;
    layer.skewXDeg = look.skewXDeg ?? 0;
    layer.letterSpacingPx = fragments.length > 1 ? 0 : (look.letterSpacingPx ?? 0);
    return layer;
  });
}

function place(layer: CutInLayer, box: Box): void {
  layer.x = box.x;
  layer.y = box.y;
  layer.width = Math.max(8, box.width);
  layer.height = Math.max(2, box.height);
}

/** A soft circle with a big glyph over it that sways in, floats and drifts away upward. */
function bloom(scene: CutInScene, stage: Stage, text: string, size: { circle: number; glyph: number }): void {
  const circle = band(scene, stage, 'circle', {
    ...centered(stage, size.circle),
    clip: 'circle',
    shape: 'radial',
    from: '#ad426d',
    to: '#e08ab3',
    opacity: 0.85,
  });
  arrive(circle, 0, 400, { scale: 0.4, opacity: 0 });
  leave(circle, stage.durationMs, 500, { scale: 1.2, opacity: 0 });

  const glyph = glyphLayer(scene, stage, text, size.glyph);
  arrive(glyph, 0, 500, { dy: 80, turn: -20, opacity: 0 });
  const swayMs = stage.durationMs - 500;
  animate(glyph, {
    rotation: [
      [500, 0, 'inOutQuad'],
      [500 + swayMs * 0.25, 6, 'inOutQuad'],
      [500 + swayMs * 0.5, -6, 'inOutQuad'],
      [500 + swayMs * 0.7, 0],
    ],
  });
  leave(glyph, stage.durationMs, 500, { dy: -60, opacity: 0 });
}

/** A circle with a big glyph over it that pops in, beats twice and floats away upward. */
function heartbeat(scene: CutInScene, stage: Stage, text: string, size: { circle: number; glyph: number }): void {
  const circle = band(scene, stage, 'circle', {
    ...centered(stage, size.circle),
    clip: 'circle',
    shape: 'radial',
    from: '#ba2e58',
    to: '#e36c88',
    opacity: 0.85,
  });
  arrive(circle, 0, 300, { scale: 0 }, 'outBack');
  leave(circle, stage.durationMs, 300, { scale: 1.3, opacity: 0 });

  const glyph = glyphLayer(scene, stage, text, size.glyph);
  arrive(glyph, 80, 300, { scale: 0.3, opacity: 0 }, 'outBack');
  const beat: Key[] = [
    [440, 1, 'outQuad'],
    [540, 1.18, 'inQuad'],
    [640, 1, 'outQuad'],
    [740, 1.12, 'inQuad'],
    [840, 1],
  ];
  animate(glyph, { scaleX: beat, scaleY: beat });
  leave(glyph, stage.durationMs, 300, { dy: -50, scale: 1.1, opacity: 0 });
}

function glyphLayer(scene: CutInScene, stage: Stage, text: string, sizePx: number): CutInLayer {
  const layer = addLayer(scene, 'text', text, stage);
  place(layer, centered(stage, Math.round(sizePx * 1.3)));
  layer.text = text;
  layer.fontSizePx = sizePx;
  layer.color = '#ffe3ea';
  layer.strokeColor = '#7a1030';
  layer.strokeWidthPx = 3;
  return layer;
}

function centered(stage: Stage, size: number): Box {
  return {
    x: Math.round((stage.width - size) / 2),
    y: Math.round((stage.height - size) / 2),
    width: size,
    height: size,
  };
}

/** Moves the layer from a pose into where it rests. */
function arrive(layer: CutInLayer, atMs: number, ms: number, from: Pose, easing: CutInEasingName = 'outCubic'): void {
  tween(layer, atMs, atMs + ms, from, {}, easing);
}

/** Moves the layer out of where it rests into a pose, getting there as the scene ends. */
function leave(layer: CutInLayer, endMs: number, ms: number, to: Pose, easing: CutInEasingName = 'inCubic'): void {
  tween(layer, Math.max(0, endMs - ms), endMs, {}, to, easing);
}

/** Two keys on every track either pose has something to say about. */
function tween(layer: CutInLayer, fromMs: number, toMs: number, from: Pose, to: Pose, easing: CutInEasingName): void {
  const motion: Partial<Record<CutInTrackName, Key[]>> = {};
  for (const track of tracksOf(from, to)) {
    motion[track] = [
      [fromMs, poseValue(layer, from, track), easing],
      [toMs, poseValue(layer, to, track)],
    ];
  }
  animate(layer, motion);
}

function tracksOf(...poses: Pose[]): CutInTrackName[] {
  const tracks = new Set<CutInTrackName>();
  for (const pose of poses) {
    if (pose.dx !== undefined) tracks.add('x');
    if (pose.dy !== undefined) tracks.add('y');
    if (pose.scale !== undefined || pose.scaleX !== undefined) tracks.add('scaleX');
    if (pose.scale !== undefined || pose.scaleY !== undefined) tracks.add('scaleY');
    if (pose.turn !== undefined) tracks.add('rotation');
    if (pose.opacity !== undefined) tracks.add('opacity');
    if (pose.blur !== undefined) tracks.add('blur');
    if (pose.wipe !== undefined) tracks.add('wipe');
    if (pose.crumble !== undefined) tracks.add('crumble');
  }
  return [...tracks];
}

function poseValue(layer: CutInLayer, pose: Pose, track: CutInTrackName): number {
  switch (track) {
    case 'x':
      return layer.x + (pose.dx ?? 0);
    case 'y':
      return layer.y + (pose.dy ?? 0);
    case 'scaleX':
      return pose.scaleX ?? pose.scale ?? layer.scaleX;
    case 'scaleY':
      return pose.scaleY ?? pose.scale ?? layer.scaleY;
    case 'rotation':
      return layer.rotation + (pose.turn ?? 0);
    case 'opacity':
      return pose.opacity ?? layer.opacity;
    case 'blur':
      return pose.blur ?? layer.blur;
    case 'wipe':
      return pose.wipe ?? layer.wipe;
    case 'crumble':
      return pose.crumble ?? layer.crumble;
  }
}

/** Writes keys into the layer's tracks, keeping those already there. */
function animate(layer: CutInLayer, motion: Partial<Record<CutInTrackName, readonly Key[]>>): void {
  let tracks = layer.trackSet;
  for (const [track, keys] of Object.entries(motion) as [CutInTrackName, readonly Key[]][]) {
    for (const [t, v, e] of keys) tracks = { ...tracks, [track]: upsertKey(tracks[track], e ? { t, v, e } : { t, v }) };
  }
  layer.tracks = encodeCutInTracks(tracks);
}
