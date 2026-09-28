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
 */
export const CUT_IN_LETTER_MOTIONS = ['none', 'pop', 'wave', 'shake'] as const;
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
export function drawsLetters(layer: { letterMotion: string; letterTiltDeg: number }): boolean {
  return (
    isCutInLetterMotion(layer.letterMotion) && (layer.letterMotion !== 'none' || tiltOf(layer.letterTiltDeg) !== 0)
  );
}

/** How far a letter leans: every other one the other way, which reads as lively rather than as a slope. */
export function letterTiltOf(index: number, tiltDeg: number): number {
  const tilt = tiltOf(tiltDeg);
  if (tilt === 0) return 0;
  return index % 2 === 0 ? -tilt : tilt;
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
 */
export function letterPoseAt(
  motion: CutInLetterMotion,
  index: number,
  tiltDeg: number,
  sizePx: number,
  ms: number,
  startMs: number
): LetterPose {
  const pose: LetterPose = { dx: 0, dy: 0, rotate: letterTiltOf(index, tiltDeg), scale: 1, opacity: 1 };
  const since = ms - startMs;

  if (motion === 'pop') {
    const local = (since - index * LETTER_STAGGER_MS) / POP_MS;
    if (local <= 0) return { ...pose, scale: 0, opacity: 0, dy: sizePx * 0.3 };
    const done = Math.min(1, local);
    pose.scale = backOut(done);
    pose.opacity = Math.min(1, done * 3);
    pose.dy = (1 - done) * sizePx * 0.3;
  } else if (motion === 'wave') {
    pose.dy = -Math.sin((Math.max(0, since) / WAVE_PERIOD_MS) * Math.PI * 2 - index * WAVE_SHIFT) * sizePx * 0.12;
  } else if (motion === 'shake') {
    const step = Math.floor(Math.max(0, since) / SHAKE_STEP_MS);
    pose.dx = (noise(index, step, 1) - 0.5) * sizePx * 0.1;
    pose.dy = (noise(index, step, 2) - 0.5) * sizePx * 0.1;
    pose.rotate += (noise(index, step, 3) - 0.5) * 8;
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
 * belong to whether it plays, loops or is held still at the scrubber.
 */
export function letterFrames(
  motion: CutInLetterMotion,
  index: number,
  tiltDeg: number,
  sizePx: number,
  startMs: number,
  durationMs: number
): CutInLetterFrame[] {
  if (durationMs <= 0) return [];
  const pose = (ms: number) => letterPoseAt(motion, index, tiltDeg, sizePx, ms, startMs);
  if (motion === 'none') {
    const still = { transform: letterTransform(pose(0)), opacity: 1 };
    return [
      { offset: 0, ...still },
      { offset: 1, ...still },
    ];
  }

  const count = Math.max(2, Math.min(MAX_FRAMES, Math.ceil(durationMs / FRAME_MS) + 1));
  const frames: CutInLetterFrame[] = [];
  for (let at = 0; at < count; at++) {
    const offset = at / (count - 1);
    const now = pose(offset * durationMs);
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
