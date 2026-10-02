import { graphemesOf } from '@axe/domain/chat/emoji-only-text';

/**
 * What a text layer says once it is played, and how its letters move.
 *
 * A text layer stays one editable string. Two things are read out of it only as it is drawn: the
 * token that stands for the name of the character the cut-in was launched for, and, where the
 * layer asks for it, the letters one at a time so each can move and lean on its own.
 */

/** Written into a text layer, it shows the name of the character the cut-in was launched for. */
export const CUT_IN_CHARACTER_TOKEN = '{character}';

/** What the token shows when the launch named nobody. A blank would leave the words around it hanging. */
export const CUT_IN_CHARACTER_FALLBACK = '？？？';

/** The token, and the token doubled, which is how a layer writes the token itself without it being replaced. */
const TOKEN_PATTERN = /\{\{character\}\}|\{character\}/g;

/** Whether a text uses the character's name, so a launch knows to carry it. */
export function usesCharacterName(text: string | null | undefined): boolean {
  if (!text) return false;
  TOKEN_PATTERN.lastIndex = 0;
  return TOKEN_PATTERN.test(text);
}

/**
 * The text with the character's name put in for the token.
 *
 * It goes through once, so a name that itself reads `{character}` is shown as it is, and nothing
 * else in the text is touched. `{{character}}` is shown as `{character}`.
 */
export function resolveCharacterName(text: string, name: string | null | undefined): string {
  if (!text.includes('{character}')) return text;
  const shown = (name ?? '').trim() || CUT_IN_CHARACTER_FALLBACK;
  return text.replace(TOKEN_PATTERN, (found) => (found.length > CUT_IN_CHARACTER_TOKEN.length ? '{character}' : shown));
}

/**
 * How the letters of a text layer move, each a little after the one before.
 *
 * - `pop`: they spring in one after another as the layer appears
 * - `wave`: they bob up and down in a wave running along the line
 * - `shake`: they tremble, each on its own
 * - `fade`: they fade in one after another where they rest
 * - `slide`: they fade in one after another, gliding the last stretch into place
 */
export const CUT_IN_LETTER_MOTIONS = ['none', 'pop', 'wave', 'shake', 'fade', 'slide'] as const;
export type CutInLetterMotion = (typeof CUT_IN_LETTER_MOTIONS)[number];

export function isCutInLetterMotion(value: unknown): value is CutInLetterMotion {
  return typeof value === 'string' && (CUT_IN_LETTER_MOTIONS as readonly string[]).includes(value);
}

/** How far a letter leans either way, past which it stops reading as a letter. */
export const MAX_LETTER_TILT_DEG = 30;

/** How long after the one before it each letter starts popping in. */
export const LETTER_STAGGER_MS = 60;
/** How long one letter takes to pop in. */
const POP_MS = 260;
/** How long one bob of the wave takes. */
const WAVE_PERIOD_MS = 900;
/** How far along the wave one letter is from the next, in radians. */
const WAVE_SHIFT = 0.6;
/** How often a trembling letter jumps to a new place. */
const SHAKE_STEP_MS = 50;
/** How finely a letter's motion is written down for the browser to run. */
const FRAME_MS = 1000 / 30;
/** At most this many frames a letter, so a long scene does not hand the browser thousands. */
const MAX_FRAMES = 360;
/**
 * About this many frames for all the letters of one layer together, so a long text stays light too.
 * A target rather than a cap: `MIN_FRAMES` comes first, so a text of more than 800 letters goes over it.
 */
const MAX_LAYER_FRAMES = 24_000;
/** However many letters there are, none is given fewer than this many frames to spend, for its motion to still read. */
const MIN_FRAMES = 30;

/** Which letter goes first: from the start of the text, from its end, or from its middle outwards. */
export const CUT_IN_LETTER_ORDERS = ['forward', 'reverse', 'center'] as const;
/** How a tilt leans the letters: every other one the other way, or all the same way. */
export const CUT_IN_LETTER_TILTS = ['alternate', 'uniform'] as const;
/** How the letters leave, one after another in the same order, before the layer goes. */
export const CUT_IN_LETTER_EXITS = ['none', 'fade', 'shrink', 'rise'] as const;
/** Which way a letter travels as it comes in. Only the motions that bring letters in use it. */
export const CUT_IN_LETTER_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export type CutInLetterOrder = (typeof CUT_IN_LETTER_ORDERS)[number];
export type CutInLetterTilt = (typeof CUT_IN_LETTER_TILTS)[number];
export type CutInLetterExit = (typeof CUT_IN_LETTER_EXITS)[number];
export type CutInLetterDirection = (typeof CUT_IN_LETTER_DIRECTIONS)[number];

/** The range each detailed timing is held to, in ms. */
export const LETTER_TIMING_LIMITS = {
  letterIntervalMs: { min: 0, max: 1000 },
  letterDurationMs: { min: 50, max: 3000 },
  letterExitDurationMs: { min: 50, max: 3000 },
} as const;

/**
 * The detailed letter controls a layer may carry.
 *
 * Each is optional, as a cut-in saved before they existed carries none of them, and may hold
 * anything a file says. They are read through `letterSettingsOf`, never as they stand.
 */
export interface CutInLetterSettings {
  letterOrder?: string;
  letterIntervalMs?: number;
  letterDurationMs?: number;
  letterTiltMode?: string;
  letterExit?: string;
  letterExitDurationMs?: number;
  letterDirection?: string;
}

/** The detailed letter controls, read safely. */
export interface CutInLetterControls {
  letterOrder: CutInLetterOrder;
  letterIntervalMs: number;
  letterDurationMs: number;
  letterTiltMode: CutInLetterTilt;
  letterExit: CutInLetterExit;
  letterExitDurationMs: number;
  letterDirection: CutInLetterDirection;
}

/**
 * The controls as they play. A missing, unknown or non-finite value is the default, which is how
 * the letters moved before there were controls; a number out of range is held to its edge.
 */
export function letterSettingsOf(settings: CutInLetterSettings = {}): CutInLetterControls {
  const limits = LETTER_TIMING_LIMITS;
  return {
    letterOrder: oneOf(CUT_IN_LETTER_ORDERS, settings.letterOrder, 'forward'),
    letterIntervalMs: bounded(settings.letterIntervalMs, LETTER_STAGGER_MS, limits.letterIntervalMs),
    letterDurationMs: bounded(settings.letterDurationMs, POP_MS, limits.letterDurationMs),
    letterTiltMode: oneOf(CUT_IN_LETTER_TILTS, settings.letterTiltMode, 'alternate'),
    letterExit: oneOf(CUT_IN_LETTER_EXITS, settings.letterExit, 'none'),
    letterExitDurationMs: bounded(settings.letterExitDurationMs, POP_MS, limits.letterExitDurationMs),
    letterDirection: oneOf(CUT_IN_LETTER_DIRECTIONS, settings.letterDirection, 'up'),
  };
}

/** The motions that bring each letter in, one after another. */
const ENTERING_MOTIONS: readonly string[] = ['pop', 'fade', 'slide'];

/**
 * Whether a detailed control changes anything for the layer's motion and exit as they stand.
 *
 * The way in matters only to the motions that move a letter in; how long a letter takes only to
 * those that bring it in; the exit's length only to an exit; and the gap between letters to either.
 * The order, the tilt and the exit itself are always open.
 */
export function letterControlTakesEffect(
  key: keyof CutInLetterControls,
  layer: { letterMotion: string } & CutInLetterSettings
): boolean {
  const enters = ENTERING_MOTIONS.includes(layer.letterMotion);
  const leaves = letterSettingsOf(layer).letterExit !== 'none';
  switch (key) {
    case 'letterDirection':
      return layer.letterMotion === 'pop' || layer.letterMotion === 'slide';
    case 'letterDurationMs':
      return enters;
    case 'letterExitDurationMs':
      return leaves;
    case 'letterIntervalMs':
      return enters || leaves;
    default:
      return true;
  }
}

/**
 * Where a letter comes in the order, from 0 for the first to go.
 *
 * From the middle, the letter at the middle (the left one of the two for an even count) goes
 * first, then one to its right, one to its left and so on, so no two letters share a moment.
 */
export function letterRank(index: number, count: number, order: CutInLetterOrder): number {
  if (order === 'reverse') return Math.max(0, count - index - 1);
  if (order === 'center') {
    const middle = Math.floor((count - 1) / 2);
    return index <= middle ? (middle - index) * 2 : (index - middle) * 2 - 1;
  }
  return index;
}

/**
 * When a letter starts leaving and how long it takes, in ms of the scene.
 *
 * The last letter to go is gone by `endMs`. Where the letters one after another would take longer
 * than the layer is on, the gap between them is shortened so they still are.
 */
function exitWindow(
  rank: number,
  letterCount: number,
  controls: CutInLetterControls,
  startMs: number,
  endMs: number
): { fromMs: number; durationMs: number } {
  const available = Math.max(0, endMs - startMs);
  const durationMs = Math.min(controls.letterExitDurationMs, available);
  const spread = Math.min(Math.max(0, letterCount - 1) * controls.letterIntervalMs, available - durationMs);
  const delay = letterCount > 1 ? (Math.min(rank, letterCount - 1) / (letterCount - 1)) * spread : 0;
  return { fromMs: endMs - durationMs - spread + delay, durationMs };
}

function bounded(value: unknown, fallback: number, range: { min: number; max: number }): number {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(range.max, Math.max(range.min, number)) : fallback;
}

function oneOf<T extends string>(choices: readonly T[], value: unknown, fallback: T): T {
  return choices.includes(value as T) ? (value as T) : fallback;
}

/** One piece of a text laid out a letter at a time: a letter, or a line break written into the text. */
export interface CutInLetter {
  text: string;
  newline: boolean;
  /** Which letter this is, counting letters only. -1 for a line break. */
  index: number;
}

/**
 * The text a letter at a time, keeping every line break where it was written.
 *
 * Letters are what a reader counts as one, so a joined emoji or a letter with its marks moves
 * as a whole.
 */
export function splitLetters(text: string): CutInLetter[] {
  const letters: CutInLetter[] = [];
  let index = 0;
  for (const [at, line] of text.split(/\r?\n/).entries()) {
    if (at > 0) letters.push({ text: '\n', newline: true, index: -1 });
    for (const letter of graphemesOf(line)) letters.push({ text: letter, newline: false, index: index++ });
  }
  return letters;
}

/** Whether a layer draws its letters one at a time rather than as one run of text. */
export function drawsLetters(layer: { letterMotion: string; letterTiltDeg: number } & CutInLetterSettings): boolean {
  return (
    isCutInLetterMotion(layer.letterMotion) &&
    (layer.letterMotion !== 'none' ||
      tiltOf(layer.letterTiltDeg) !== 0 ||
      letterSettingsOf(layer).letterExit !== 'none')
  );
}

/**
 * How far a letter leans: by default every other one the other way, which reads as lively rather
 * than as a slope; `uniform` leans them all the same way.
 */
export function letterTiltOf(index: number, tiltDeg: number, mode: string = 'alternate'): number {
  const tilt = tiltOf(tiltDeg);
  if (tilt === 0) return 0;
  return mode === 'uniform' ? tilt : index % 2 === 0 ? -tilt : tilt;
}

/** Where a letter is, relative to where it rests, at one moment of the scene. */
export interface LetterPose {
  dx: number;
  dy: number;
  rotate: number;
  scale: number;
  opacity: number;
}

/**
 * Where a letter is at a moment of the scene.
 *
 * `startMs` is when the layer comes on, which is when a letter's motion starts counting;
 * `sizePx` is the size of the letters, which the distances they move are measured in. The
 * trembling is worked out from the letter and the moment alone, so every screen shows the same.
 * `letterCount` is how many letters the text has once the character's name is in, which the
 * order is counted along; `endMs` is when the layer goes, which a leaving letter is gone by.
 */
export function letterPoseAt(
  motion: CutInLetterMotion,
  index: number,
  tiltDeg: number,
  sizePx: number,
  ms: number,
  startMs: number,
  settings: CutInLetterSettings = {},
  letterCount: number = index + 1,
  endMs: number = Infinity
): LetterPose {
  const controls = letterSettingsOf(settings);
  const rank = letterRank(index, letterCount, controls.letterOrder);
  const pose: LetterPose = {
    dx: 0,
    dy: 0,
    rotate: letterTiltOf(index, tiltDeg, controls.letterTiltMode),
    scale: 1,
    opacity: 1,
  };
  const since = ms - startMs;

  if (motion === 'pop' || motion === 'fade' || motion === 'slide') {
    const done = Math.min(1, Math.max(0, (since - rank * controls.letterIntervalMs) / controls.letterDurationMs));
    pose.scale = motion === 'pop' ? (done === 0 ? 0 : backOut(done)) : 1;
    pose.opacity = motion === 'pop' ? Math.min(1, done * 3) : done;
    const distance = motion === 'fade' ? 0 : (1 - done) * sizePx * 0.3;
    if (controls.letterDirection === 'left') pose.dx = distance;
    else if (controls.letterDirection === 'right') pose.dx = -distance;
    else pose.dy = controls.letterDirection === 'down' ? -distance : distance;
  } else if (motion === 'wave') {
    pose.dy = -Math.sin((Math.max(0, since) / WAVE_PERIOD_MS) * Math.PI * 2 - rank * WAVE_SHIFT) * sizePx * 0.12;
  } else if (motion === 'shake') {
    const step = Math.floor(Math.max(0, since) / SHAKE_STEP_MS);
    pose.dx = (noise(index, step, 1) - 0.5) * sizePx * 0.1;
    pose.dy = (noise(index, step, 2) - 0.5) * sizePx * 0.1;
    pose.rotate += (noise(index, step, 3) - 0.5) * 8;
  }
  if (controls.letterExit !== 'none' && Number.isFinite(endMs)) {
    const exit = exitWindow(rank, letterCount, controls, startMs, endMs);
    const progress =
      exit.durationMs > 0 ? Math.min(1, Math.max(0, (ms - exit.fromMs) / exit.durationMs)) : Number(ms >= endMs);
    pose.opacity *= 1 - progress;
    if (controls.letterExit === 'shrink') pose.scale *= 1 - progress;
    if (controls.letterExit === 'rise') pose.dy -= progress * sizePx * 0.5;
  }
  return pose;
}

/** One frame of a letter's motion, from 0 to 1 along the scene. */
export type CutInLetterFrame = {
  offset: number;
  transform: string;
  opacity: number;
};

/** A pose as the CSS transform that puts a letter there. */
export function letterTransform(pose: LetterPose): string {
  const round = (value: number) => Math.round(value * 100) / 100;
  return `translate(${round(pose.dx)}px, ${round(pose.dy)}px) rotate(${round(pose.rotate)}deg) scale(${round(pose.scale)})`;
}

/**
 * A letter's motion over the whole scene, as the frames the browser runs.
 *
 * They are laid over the scene's own length, so the letters stay in step with the layer they
 * belong to whether it plays, loops or is held still at the scrubber. The moments a letter starts
 * and finishes coming in and leaving are written down exactly, so a brief motion in a long scene
 * is not smoothed away between two frames.
 */
export function letterFrames(
  motion: CutInLetterMotion,
  index: number,
  tiltDeg: number,
  sizePx: number,
  startMs: number,
  durationMs: number,
  settings: CutInLetterSettings = {},
  letterCount: number = index + 1,
  endMs: number = durationMs
): CutInLetterFrame[] {
  if (durationMs <= 0) return [];
  const controls = letterSettingsOf(settings);
  const pose = (ms: number) => letterPoseAt(motion, index, tiltDeg, sizePx, ms, startMs, settings, letterCount, endMs);
  if (motion === 'none' && controls.letterExit === 'none') {
    const still = { transform: letterTransform(pose(0)), opacity: 1 };
    return [
      { offset: 0, ...still },
      { offset: 1, ...still },
    ];
  }

  // A few of the letter's frames are kept back for the exact moments below.
  const budget = Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, Math.floor(MAX_LAYER_FRAMES / Math.max(1, letterCount))));
  const count = Math.max(2, Math.min(budget - 8, Math.ceil(durationMs / FRAME_MS) + 1));
  const moments = new Set(Array.from({ length: count }, (_, at) => (at / (count - 1)) * durationMs));
  const rank = letterRank(index, letterCount, controls.letterOrder);
  const entrance = startMs + rank * controls.letterIntervalMs;
  const exit = exitWindow(rank, letterCount, controls, startMs, endMs);
  const exact = [entrance, entrance + controls.letterDurationMs / 3, entrance + controls.letterDurationMs];
  if (controls.letterExit !== 'none') exact.push(exit.fromMs, exit.fromMs + exit.durationMs);
  for (const moment of [startMs, ...exact, endMs]) {
    if (moment >= 0 && moment <= durationMs) moments.add(moment);
  }
  const frames: CutInLetterFrame[] = [];
  for (const moment of [...moments].sort((a, b) => a - b)) {
    const offset = moment / durationMs;
    const now = pose(moment);
    frames.push({ offset, transform: letterTransform(now), opacity: now.opacity });
  }
  return frames;
}

function tiltOf(tiltDeg: number): number {
  const tilt = Number(tiltDeg);
  if (!Number.isFinite(tilt)) return 0;
  return Math.min(MAX_LETTER_TILT_DEG, Math.max(-MAX_LETTER_TILT_DEG, tilt));
}

/** It swells a little past full size and settles, which reads as springing in. */
function backOut(value: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

/** A number from 0 to 1 that depends on nothing but what it is given. */
function noise(index: number, step: number, salt: number): number {
  const seed = Math.sin(index * 127.1 + step * 311.7 + salt * 74.7) * 43758.5453;
  return seed - Math.floor(seed);
}
