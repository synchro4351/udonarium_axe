import { graphemesOf } from '@axe/domain/chat/emoji-only-text';
import { type EffectPreset, REACTION_THROW_LAND } from '@axe/domain/effect/effect-preset';
import { ringSvg } from '@axe/domain/effect/effect-shapes';
import {
  blank,
  clamp01,
  colorsOf,
  easeOutCubic,
  type EffectSprite,
  type EffectSpriteOptions,
  type Point3,
  takeRandoms,
} from '@axe/domain/effect/timeline/shared';

/**
 * The light reactions: a mark of the preset's own popping up at the target, thrown at it, or
 * raining down on it.
 *
 * They are passing remarks rather than attacks, so each is a handful of sprites with no
 * particles, no shake and no flash, and the preset holds them to a short length.
 */

/** What a reaction shows when it has neither a picture it can find nor any text. */
export const REACTION_FALLBACK_TEXT = '❔';

/** How many marks fall per target, by grade. More would bury the piece they are meant to cheer. */
const RAIN_COUNT: Record<1 | 2 | 3, number> = { 1: 5, 2: 8, 3: 12 };
/** How late the last mark of a rain may start falling, so every one has landed by 80%. */
const RAIN_LATEST_START = 0.45;
/** How long one mark takes to fall. */
const RAIN_FALL = 0.35;
/** How far across the target the rain spreads, in cells. */
const RAIN_SPREAD = 2.4;
/** How high the rain starts, in cells above the target. */
const RAIN_HEIGHT = 6;

/** The picture or the text a reaction shows. Exactly one of the two is filled. */
export interface ReactionMark {
  image: string;
  text: string;
}

/**
 * What a reaction shows: its picture where the room has it, otherwise its text.
 *
 * A picture that is missing, or has not arrived yet, falls back to the text and, with no text
 * either, to a question mark: showing nothing would read as the button not working.
 */
export function reactionMarkOf(preset: EffectPreset, options: EffectSpriteOptions): ReactionMark {
  const identifier = (preset.reactionImageIdentifier ?? '').trim();
  if (identifier.length > 0) {
    const url = options.resolveImageFile?.(identifier) ?? '';
    if (url.length > 0) return { image: url, text: '' };
  }
  const label = preset.reactionLabel;
  return { image: '', text: label.length > 0 ? label : REACTION_FALLBACK_TEXT };
}

/** A mark popping up over the target, rising a little and fading. */
export function appendReactionPop(
  sprites: EffectSprite[],
  prefix: string,
  center: Point3,
  base: number,
  progress: number,
  preset: EffectPreset,
  mark: ReactionMark
): void {
  const appear = clamp01(progress / 0.18);
  const fade = progress < 0.7 ? 1 : 1 - clamp01((progress - 0.7) / 0.3);
  pushMark(sprites, mark, preset, `${prefix}-reactpop`, {
    x: center.x,
    y: center.y,
    z: center.z + base * (1.2 + easeOutCubic(progress) * 0.7),
    size: base * 1.1 * overshoot(appear),
    opacity: Math.min(1, progress / 0.05) * fade,
    rotate: 0,
  });
}

/** A mark thrown from the caster in an arc, bouncing where it lands and fading. */
export function appendReactionThrow(
  sprites: EffectSprite[],
  prefix: string,
  center: Point3,
  base: number,
  progress: number,
  preset: EffectPreset,
  origin: Point3,
  mark: ReactionMark
): void {
  const landing = { x: center.x, y: center.y, z: center.z + base * 0.9 };
  const size = base * 0.9;

  if (progress < REACTION_THROW_LAND) {
    const at = clamp01(progress / REACTION_THROW_LAND);
    pushMark(sprites, mark, preset, `${prefix}-reactthrow`, {
      x: origin.x + (landing.x - origin.x) * at,
      y: origin.y + (landing.y - origin.y) * at,
      z: origin.z + (landing.z - origin.z) * at + Math.sin(Math.PI * at) * base * 1.6,
      size,
      opacity: 1,
      rotate: at * 540,
    });
    return;
  }

  const local = clamp01((progress - REACTION_THROW_LAND) / (1 - REACTION_THROW_LAND));
  const bounce = Math.abs(Math.sin(local * Math.PI * 2)) * (1 - local) * base * 0.5;
  // It lands squashed and springs back, which is what makes it read as having hit something.
  const squash = 1 + Math.max(0, 0.25 - local) * 1.2;
  pushMark(sprites, mark, preset, `${prefix}-reactthrow`, {
    x: landing.x,
    y: landing.y,
    z: landing.z + bounce,
    size: size * squash,
    opacity: local < 0.6 ? 1 : 1 - (local - 0.6) / 0.4,
    rotate: 540,
  });

  const ring = clamp01(local / 0.5);
  if (ring < 1) {
    const width = base * (0.6 + easeOutCubic(ring) * 1.2);
    sprites.push({
      ...blank(),
      key: `${prefix}-reactthrow-ring`,
      x: center.x,
      y: center.y,
      z: center.z + 1,
      width,
      height: width,
      opacity: (1 - ring) * 0.7,
      svg: ringSvg(colorsOf(preset), 6),
      flat: true,
    });
  }
}

/** A handful of marks falling about the target, each landing and fading where it fell. */
export function appendReactionRain(
  sprites: EffectSprite[],
  prefix: string,
  center: Point3,
  base: number,
  progress: number,
  preset: EffectPreset,
  random: () => number,
  mark: ReactionMark
): void {
  const count = RAIN_COUNT[preset.gradeLevel];
  // Drawn up front, so how far through it is does not change how much randomness is used.
  const jitters = takeRandoms(random, count * 4);

  for (let drop = 0; drop < count; drop++) {
    const across = jitters[drop * 4] - 0.5;
    const along = jitters[drop * 4 + 1] - 0.5;
    // The first falls at once, so pressing it shows something straight away.
    const born = drop === 0 ? 0 : jitters[drop * 4 + 2] * RAIN_LATEST_START;
    const spin = jitters[drop * 4 + 3];
    const local = (progress - born) / RAIN_FALL;
    if (local <= 0) continue;

    const fall = clamp01(local);
    const landed = born + RAIN_FALL;
    pushMark(sprites, mark, preset, `${prefix}-reactrain-${drop}`, {
      x: center.x + across * base * RAIN_SPREAD,
      y: center.y + along * base * RAIN_SPREAD,
      z: center.z + base * 0.35 + (1 - fall * fall) * base * RAIN_HEIGHT,
      size: base * 0.6 * (0.8 + spin * 0.4),
      opacity: progress <= landed ? 1 : 1 - clamp01((progress - landed) / (1 - landed)),
      rotate: (spin - 0.5) * 50 + Math.sin(fall * Math.PI * 2 + spin * 6) * 12 * (1 - fall),
    });
  }
}

interface MarkPlacement {
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  rotate: number;
}

/** One mark facing the camera: a picture fitted into a square, or a line of text as wide as it runs. */
function pushMark(
  sprites: EffectSprite[],
  mark: ReactionMark,
  preset: EffectPreset,
  key: string,
  place: MarkPlacement
): void {
  const sprite: EffectSprite = {
    ...blank(),
    key,
    x: place.x,
    y: place.y,
    z: place.z,
    width: place.size,
    height: place.size,
    rotate: place.rotate,
    opacity: clamp01(place.opacity),
  };
  if (mark.image.length > 0) {
    sprite.background = `url("${mark.image}") center/contain no-repeat`;
  } else {
    sprite.width = place.size * Math.max(1, graphemesOf(mark.text).length * 0.8);
    sprite.text = mark.text;
    sprite.textColor = preset.colorPrimary;
  }
  sprites.push(sprite);
}

/** It swells a little past full size as it appears and settles, which reads as popping. */
function overshoot(value: number): number {
  const clamped = clamp01(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2);
}
