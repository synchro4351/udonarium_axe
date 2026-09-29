/**
 * The character portrait a cut-in template shows in its portrait slot.
 *
 * A template marks one or more image layers as a portrait slot. At play time the sender picks a
 * character's picture, looks up how that character fitted the picture to the slot's frame, and
 * sends both along with the launch as a snapshot. Every peer draws the slot from that snapshot
 * rather than from the character as it stands later. The image itself is still resolved from room
 * media storage.
 *
 * A fit belongs to the character, per picture and per frame, so one fit serves every cut-in whose
 * slot uses that frame, and two characters sharing a picture fit it each their own way. It is kept
 * on the character as JSON: `{ [frame]: { [imageIdentifier]: fit } }`.
 *
 * The same snapshot carries the character's name for `{character}` in a text layer, so a scene
 * that names the character but has no portrait slot still sends one.
 */

import { usesCharacterName } from '@axe/domain/media/cut-in-text';

/**
 * The shapes a portrait slot can be fitted to. Head and shoulders is the first; a frame added later,
 * such as a full-length one, keeps its fits beside these rather than over them.
 */
export const CUT_IN_PORTRAIT_FRAMES = ['bust'] as const;
export type CutInPortraitFrame = (typeof CUT_IN_PORTRAIT_FRAMES)[number];

export const DEFAULT_PORTRAIT_FRAME: CutInPortraitFrame = 'bust';

/** What a frame looks like: its proportions, and the outline a picture is lined up against. */
export interface CutInPortraitFrameShape {
  /** Width over height of the slot the frame stands for. */
  aspectRatio: number;
  /** The outline, drawn standing on the bottom of the slot, in a 200 by 200 box. */
  head: { cx: number; cy: number; r: number };
  shoulders: string;
}

export const CUT_IN_PORTRAIT_FRAME_SHAPES: Readonly<Record<CutInPortraitFrame, CutInPortraitFrameShape>> =
  Object.freeze({
    bust: {
      aspectRatio: 340 / 400,
      head: { cx: 100, cy: 76, r: 40 },
      shoulders: 'M24 200 C24 150 58 122 100 122 C142 122 176 150 176 200 Z',
    },
  });

/** Whether a value names a frame this copy of the app knows. */
export function isPortraitFrame(value: unknown): value is CutInPortraitFrame {
  return typeof value === 'string' && (CUT_IN_PORTRAIT_FRAMES as readonly string[]).includes(value);
}

/**
 * The frame every fit is measured in, in the cut-in's own pixels. A slot of this size shows exactly
 * the frame; a slot of another shape shows the frame scaled to cover it, centred.
 */
export const PORTRAIT_FRAME_WIDTH = 340;
export const PORTRAIT_FRAME_HEIGHT = 400;

/**
 * How a picture sits in a portrait slot. At scale 1 and no offset the whole picture is shown,
 * as large as fits in the frame and centred. `scale` sizes it from there around its centre, and
 * `x` and `y` move its centre away from the frame's centre, in frame pixels.
 */
export interface CutInPortraitFit {
  scale: number;
  x: number;
  y: number;
}

/** What a launch carries so every peer draws the same portrait. */
export interface CutInPortraitSnapshot {
  /** The character the portrait came from, kept only to say whose it was. Empty for none. */
  characterIdentifier: string;
  /** The picture, by the identifier the image storage knows it by. Empty draws the silhouette. */
  imageIdentifier: string;
  fit: CutInPortraitFit;
  /**
   * The character's name as it was at launch, for `{character}` in a text layer. Empty shows the
   * stand-in. A launch from an older copy of the app carries none.
   */
  characterName: string;
}

export const MIN_PORTRAIT_SCALE = 0.25;
export const MAX_PORTRAIT_SCALE = 12;

/** The whole picture, centred, so nothing is cut off before someone fits it. */
export const DEFAULT_CUT_IN_PORTRAIT_FIT: Readonly<CutInPortraitFit> = Object.freeze({ scale: 1, x: 0, y: 0 });

/**
 * How the silhouette sits: whole, standing on the bottom of the frame. Its square drawing fills
 * the frame's width and so leaves the difference in height to drop it by.
 */
export const SILHOUETTE_PORTRAIT_FIT: Readonly<CutInPortraitFit> = Object.freeze({
  scale: 1,
  x: 0,
  y: (PORTRAIT_FRAME_HEIGHT - PORTRAIT_FRAME_WIDTH) / 2,
});

const MAX_FITS = 64;

const BUST = CUT_IN_PORTRAIT_FRAME_SHAPES.bust;

/**
 * A plain head-and-shoulders shape, drawn in the slot while no picture is given or the picture is
 * missing. It is built in rather than stored, so it needs no file in a saved room and no network.
 */
export const CUT_IN_PORTRAIT_SILHOUETTE_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
      '<g fill="#8b93a3" fill-opacity="0.85">' +
      `<circle cx="${BUST.head.cx}" cy="${BUST.head.cy}" r="${BUST.head.r}"/>` +
      `<path d="${BUST.shoulders}"/>` +
      '</g></svg>'
  );

/**
 * A fit held to the range the slot can show. Anything without a readable `scale` is not a fit and
 * falls back to the default; an offset that is missing or unreadable is taken as none.
 */
export function normalizePortraitFit(value: unknown): CutInPortraitFit {
  if (!isPlainObject(value)) return { ...DEFAULT_CUT_IN_PORTRAIT_FIT };
  const scale = readNumber(value['scale'], Number.NaN);
  if (!Number.isFinite(scale)) return { ...DEFAULT_CUT_IN_PORTRAIT_FIT };
  return clampPortraitFit({
    scale,
    x: readNumber(value['x'], DEFAULT_CUT_IN_PORTRAIT_FIT.x),
    y: readNumber(value['y'], DEFAULT_CUT_IN_PORTRAIT_FIT.y),
  });
}

/**
 * A fit held to the sizes a slot can show, and to where some of the picture can still be over the
 * frame. The picture may otherwise be moved anywhere, well past the frame's edges.
 */
export function clampPortraitFit(fit: CutInPortraitFit): CutInPortraitFit {
  const scale = clamp(finiteOr(fit.scale, 1), MIN_PORTRAIT_SCALE, MAX_PORTRAIT_SCALE);
  const reachX = (PORTRAIT_FRAME_WIDTH / 2) * (1 + scale);
  const reachY = (PORTRAIT_FRAME_HEIGHT / 2) * (1 + scale);
  return {
    scale: round(scale, 1000),
    x: round(clamp(finiteOr(fit.x, 0), -reachX, reachX), 10),
    y: round(clamp(finiteOr(fit.y, 0), -reachY, reachY), 10),
  };
}

/** Reads the fits a character keeps, by frame and then by picture. Anything unreadable comes back as none. */
export function parseCharacterPortraitFits(
  raw: string | null | undefined
): Partial<Record<CutInPortraitFrame, Record<string, CutInPortraitFit>>> {
  const parsed = parseJsonObject(raw);
  if (!parsed) return {};
  const byFrame: Partial<Record<CutInPortraitFrame, Record<string, CutInPortraitFit>>> = {};
  for (const frame of CUT_IN_PORTRAIT_FRAMES) {
    const fits = readFits(parsed[frame]);
    if (Object.keys(fits).length > 0) byFrame[frame] = fits;
  }
  return byFrame;
}

/** How the character fitted a picture to a frame, or none when it never did. */
export function characterPortraitFitIn(
  raw: string | null | undefined,
  frame: CutInPortraitFrame,
  imageIdentifier: string
): CutInPortraitFit | null {
  if (!imageIdentifier) return null;
  return parseCharacterPortraitFits(raw)[frame]?.[imageIdentifier] ?? null;
}

/**
 * The character's fits with one picture's fit to a frame written in, or taken out for none, as the
 * JSON it stores.
 *
 * The most recent fit is kept last in its frame, and the oldest are dropped past 64, so a character
 * whose pictures are swapped often does not grow without end.
 */
export function withCharacterPortraitFit(
  raw: string | null | undefined,
  frame: CutInPortraitFrame,
  imageIdentifier: string,
  fit: CutInPortraitFit | null
): string {
  const byFrame = parseCharacterPortraitFits(raw);
  if (!imageIdentifier) return encodeFits(byFrame);
  const fits = { ...byFrame[frame] };
  delete fits[imageIdentifier];
  if (fit) fits[imageIdentifier] = normalizePortraitFit(fit);
  const entries = Object.entries(fits);
  if (entries.length > 0) byFrame[frame] = Object.fromEntries(entries.slice(Math.max(0, entries.length - MAX_FITS)));
  else delete byFrame[frame];
  return encodeFits(byFrame);
}

/** The fit a launch carries for a picture: the character's own, else the default. */
export function launchPortraitFit(
  characterFits: string | null | undefined,
  frame: CutInPortraitFrame,
  imageIdentifier: string
): CutInPortraitFit {
  return characterPortraitFitIn(characterFits, frame, imageIdentifier) ?? { ...DEFAULT_CUT_IN_PORTRAIT_FIT };
}

/** Writes a launch snapshot for the launcher to carry. None writes as empty. */
export function encodePortraitSnapshot(snapshot: CutInPortraitSnapshot | null): string {
  if (!snapshot) return '';
  return JSON.stringify({
    c: snapshot.characterIdentifier,
    i: snapshot.imageIdentifier,
    f: normalizePortraitFit(snapshot.fit),
    n: snapshot.characterName,
  });
}

/** Reads a launch snapshot back. Empty or unreadable is none. */
export function parsePortraitSnapshot(raw: string | null | undefined): CutInPortraitSnapshot | null {
  if (!raw || raw.trim().length < 1) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const source = parsed as Record<string, unknown>;
    return {
      characterIdentifier: typeof source['c'] === 'string' ? source['c'] : '',
      imageIdentifier: typeof source['i'] === 'string' ? source['i'] : '',
      fit: normalizePortraitFit(source['f']),
      characterName: typeof source['n'] === 'string' ? source['n'] : '',
    };
  } catch {
    return null;
  }
}

/** What a portrait slot needs to know about the layers of a template. */
export interface PortraitSlotLayer {
  kind: string;
  portraitSlot: boolean;
  /** A text layer's words, which may name the character. */
  text?: string;
}

/** Whether a layer takes the launched portrait rather than its own picture. */
export function isPortraitSlot(layer: PortraitSlotLayer): boolean {
  return layer.kind === 'image' && layer.portraitSlot === true;
}

/** Whether a template has anywhere to show a portrait. */
export function hasPortraitSlot(layers: readonly PortraitSlotLayer[]): boolean {
  return layers.some(isPortraitSlot);
}

/** Whether a template shows the name of the character it is launched for somewhere in its text. */
export function namesCharacter(layers: readonly PortraitSlotLayer[]): boolean {
  return layers.some((layer) => layer.kind === 'text' && usesCharacterName(layer.text));
}

/**
 * The frame a template's portrait slots are fitted to. Every slot is head and shoulders for now; a
 * later frame would be read off the slot here.
 */
export function portraitFrameOf(layers: readonly PortraitSlotLayer[]): CutInPortraitFrame {
  void layers;
  return DEFAULT_PORTRAIT_FRAME;
}

/**
 * The snapshot a launch carries, taken from the template, the chosen picture and its fit as they
 * stand now.
 *
 * A template with neither a portrait slot nor the character's name in its text carries none, so a
 * cut-in that never had either plays exactly as before. Without a picture or a name the snapshot
 * still goes, so every peer shows the silhouette and the same stand-in for the name.
 */
export function makePortraitSnapshot(
  template: { layers: readonly PortraitSlotLayer[] } | null,
  characterIdentifier: string,
  imageIdentifier: string,
  characterName = '',
  fit: CutInPortraitFit = DEFAULT_CUT_IN_PORTRAIT_FIT
): CutInPortraitSnapshot | null {
  if (!template || !(hasPortraitSlot(template.layers) || namesCharacter(template.layers))) return null;
  return {
    characterIdentifier,
    imageIdentifier,
    fit: normalizePortraitFit(fit),
    characterName: characterName.trim(),
  };
}

/** The picture a slot shows and how, falling back to the silhouette when the picture is not to be had. */
export interface ResolvedPortrait {
  url: string;
  fit: CutInPortraitFit;
  silhouette: boolean;
}

export function resolvePortrait(
  snapshot: CutInPortraitSnapshot | null,
  urlOf: (imageIdentifier: string) => string
): ResolvedPortrait {
  const url = snapshot?.imageIdentifier ? urlOf(snapshot.imageIdentifier) : '';
  if (url && snapshot) return { url, fit: snapshot.fit, silhouette: false };
  return { url: CUT_IN_PORTRAIT_SILHOUETTE_URL, fit: { ...SILHOUETTE_PORTRAIT_FIT }, silhouette: true };
}

/**
 * A fit with the picture dragged by a distance in frame pixels. The picture moves exactly as far as
 * the pointer, the same way at any size, and may be taken past the frame's edges.
 */
export function panPortraitFit(fit: CutInPortraitFit, dx: number, dy: number): CutInPortraitFit {
  return clampPortraitFit({ scale: fit.scale, x: fit.x + dx, y: fit.y + dy });
}

/**
 * A fit with the picture blown up or shrunk by a factor around a point, given in frame pixels from
 * the frame's centre, so whatever of the picture is under that point stays under it. Without a
 * point it sizes around the frame's centre.
 */
export function zoomPortraitFit(
  fit: CutInPortraitFit,
  factor: number,
  at: { x: number; y: number } = { x: 0, y: 0 }
): CutInPortraitFit {
  const from = clampPortraitFit(fit).scale;
  const scale = clamp(from * finiteOr(factor, 1), MIN_PORTRAIT_SCALE, MAX_PORTRAIT_SCALE);
  const applied = scale / from;
  return clampPortraitFit({
    scale,
    x: at.x - applied * (at.x - fit.x),
    y: at.y - applied * (at.y - fit.y),
  });
}

/**
 * The styles that put a picture into a frame-shaped box the way the fit says. The picture is drawn
 * whole in the box (`object-fit: contain`) and then moved and sized, so the offset is given as a
 * share of the box and holds at whatever size the box is drawn.
 */
export function portraitFitCss(fit: CutInPortraitFit): { transform: string; origin: string } {
  const across = (fit.x / PORTRAIT_FRAME_WIDTH) * 100;
  const down = (fit.y / PORTRAIT_FRAME_HEIGHT) * 100;
  return { transform: `translate(${across}%, ${down}%) scale(${fit.scale})`, origin: '50% 50%' };
}

/**
 * How a portrait slot draws its picture: whole in a frame-shaped box (`object-fit: contain`), then
 * moved and sized.
 */
export interface PortraitSlotCss {
  /** The box the picture is fitted in, in the slot's own pixels. */
  box: { left: number; top: number; width: number; height: number };
  transform: string;
  origin: string;
}

/**
 * How a portrait slot of a given size draws a picture with a fit. The frame is scaled to cover the
 * slot and centred in it, so a slot the frame's size shows just what the fitting showed.
 */
export function portraitSlotCss(fit: CutInPortraitFit, slot: { width: number; height: number }): PortraitSlotCss {
  const width = Math.max(0, slot.width);
  const height = Math.max(0, slot.height);
  const cover = Math.max(width / PORTRAIT_FRAME_WIDTH, height / PORTRAIT_FRAME_HEIGHT);
  const boxWidth = PORTRAIT_FRAME_WIDTH * cover;
  const boxHeight = PORTRAIT_FRAME_HEIGHT * cover;
  return {
    box: { left: (width - boxWidth) / 2, top: (height - boxHeight) / 2, width: boxWidth, height: boxHeight },
    ...portraitFitCss(fit),
  };
}

/** Reads the fits of one frame, by picture. Anything unreadable comes back as none. */
function readFits(value: unknown): Record<string, CutInPortraitFit> {
  if (!isPlainObject(value)) return {};
  const fits: Record<string, CutInPortraitFit> = {};
  for (const [identifier, fit] of Object.entries(value).slice(0, MAX_FITS)) {
    if (identifier.length > 0) fits[identifier] = normalizePortraitFit(fit);
  }
  return fits;
}

function encodeFits(fits: object): string {
  return Object.keys(fits).length > 0 ? JSON.stringify(fits) : '';
}

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw || raw.trim().length < 1) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback: number): number {
  const read = Number(value);
  return typeof value !== 'boolean' && value !== null && value !== '' && Number.isFinite(read) ? read : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function round(value: number, steps: number): number {
  return Math.round(value * steps) / steps;
}
