/**
 * Effects laid over a piece's picture, after Udonarium with Fly: turned the other way round, faded
 * like a ghost, painted black as a silhouette, browned, darkened, flashing red, shaking, and an aura
 * of one colour around it. They are a look only; the piece itself is not changed by any of them.
 */
export const IMAGE_EFFECT_TOGGLES = ['flip', 'ghost', 'silhouette', 'sepia', 'dark', 'flash', 'shake'] as const;

export type ImageEffectToggle = (typeof IMAGE_EFFECT_TOGGLES)[number];

/** The aura colours, as in Fly. */
export const IMAGE_AURA_COLORS = {
  black: '#000000',
  blue: '#3333ff',
  green: '#33ff33',
  cyan: '#33ffff',
  red: '#ff0000',
  magenta: '#ff00ff',
  yellow: '#ffff33',
  white: '#ffffff',
} as const;

export type ImageAura = keyof typeof IMAGE_AURA_COLORS;

export interface ImageEffects {
  readonly toggles: ReadonlySet<ImageEffectToggle>;
  readonly aura: ImageAura | null;
}

export const NO_IMAGE_EFFECTS: ImageEffects = { toggles: new Set(), aura: null };

const AURA_PREFIX = 'aura:';

/** Reads the effects saved on a piece, as words split by spaces; a word not known is passed over. */
export function readImageEffects(text: string): ImageEffects {
  const toggles = new Set<ImageEffectToggle>();
  let aura: ImageAura | null = null;
  for (const word of text.trim().split(/\s+/)) {
    if ((IMAGE_EFFECT_TOGGLES as readonly string[]).includes(word)) toggles.add(word as ImageEffectToggle);
    else if (word.startsWith(AURA_PREFIX) && word.slice(AURA_PREFIX.length) in IMAGE_AURA_COLORS) {
      aura = word.slice(AURA_PREFIX.length) as ImageAura;
    }
  }
  return { toggles, aura };
}

/** The effects written back as they are saved, in a fixed order so the same effects read the same. */
export function writeImageEffects(effects: ImageEffects): string {
  const words: string[] = IMAGE_EFFECT_TOGGLES.filter((toggle) => effects.toggles.has(toggle));
  if (effects.aura) words.push(`${AURA_PREFIX}${effects.aura}`);
  return words.join(' ');
}

/** The saved effects with one effect turned on or off. */
export function toggleImageEffect(text: string, toggle: ImageEffectToggle): string {
  const effects = readImageEffects(text);
  const toggles = new Set(effects.toggles);
  if (toggles.has(toggle)) toggles.delete(toggle);
  else toggles.add(toggle);
  return writeImageEffects({ toggles, aura: effects.aura });
}

/** The saved effects with the aura set, or taken off with null. */
export function withImageAura(text: string, aura: ImageAura | null): string {
  return writeImageEffects({ toggles: readImageEffects(text).toggles, aura });
}

export interface ImageEffectStyle {
  /** The filter on the picture, or null for none. */
  readonly filter: string | null;
  /**
   * The mirror, as the `scale` property. Only a picture with no transform of its own takes it as it
   * is; one turned to the camera is mirrored inside that turn instead (see `pieceImageView`).
   */
  readonly scale: string | null;
  readonly opacity: number | null;
  /** The animations, or null for none. They move `translate` and `filter`, never `transform`. */
  readonly animation: string | null;
}

export const PLAIN_IMAGE_STYLE: ImageEffectStyle = { filter: null, scale: null, opacity: null, animation: null };

/**
 * How the effects are drawn on a picture. Everything goes on the picture itself rather than on what
 * holds it: a filter on a holder would flatten the pictures standing up inside it.
 */
export function imageEffectStyle(effects: ImageEffects): ImageEffectStyle {
  const { toggles, aura } = effects;
  if (toggles.size === 0 && !aura) return PLAIN_IMAGE_STYLE;
  const filters: string[] = [];
  if (toggles.has('silhouette')) filters.push('brightness(0)');
  if (toggles.has('sepia')) filters.push('sepia(0.85)');
  if (toggles.has('dark')) filters.push('brightness(0.55)');
  if (toggles.has('ghost')) filters.push('blur(1px)');
  if (aura)
    filters.push(`drop-shadow(0 0 3px ${IMAGE_AURA_COLORS[aura]}) drop-shadow(0 -4px 4px ${IMAGE_AURA_COLORS[aura]})`);
  const animations: string[] = [];
  if (toggles.has('flash')) animations.push('imageEffectFlash 1.2s ease-in-out infinite');
  if (toggles.has('shake')) animations.push('imageEffectShake 0.5s linear infinite');
  const filter = filters.length > 0 ? filters.join(' ') : null;
  return {
    filter,
    scale: toggles.has('flip') ? '-1 1' : null,
    opacity: toggles.has('ghost') ? 0.6 : null,
    animation: animations.length > 0 ? animations.join(', ') : null,
  };
}
