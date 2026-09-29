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
 * Scenes saved before fits moved to the character keep theirs as JSON keyed by the picture. Those
 * are only read, as the fit for a picture its character has not fitted yet.
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

/** How a picture sits in a portrait slot: blown up around a focus point given as a percentage across and down. */
export interface CutInPortraitFit {
  zoom: number;
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

export const MIN_PORTRAIT_ZOOM = 0.5;
export const MAX_PORTRAIT_ZOOM = 4;

/** Top and centre, since a standing picture keeps its face near the top. */
export const DEFAULT_CUT_IN_PORTRAIT_FIT: Readonly<CutInPortraitFit> = Object.freeze({ zoom: 1, x: 50, y: 0 });

/** How the silhouette sits: whole, standing on the bottom of the slot. */
export const SILHOUETTE_PORTRAIT_FIT: Readonly<CutInPortraitFit> = Object.freeze({ zoom: 1, x: 50, y: 100 });

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

/** A fit held to the range the slot can show. Anything unreadable falls back to the default. */
export function normalizePortraitFit(value: unknown): CutInPortraitFit {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_CUT_IN_PORTRAIT_FIT };
  const source = value as Record<string, unknown>;
  return {
    zoom: clamp(readNumber(source['zoom'], DEFAULT_CUT_IN_PORTRAIT_FIT.zoom), MIN_PORTRAIT_ZOOM, MAX_PORTRAIT_ZOOM),
    x: clamp(readNumber(source['x'], DEFAULT_CUT_IN_PORTRAIT_FIT.x), 0, 100),
    y: clamp(readNumber(source['y'], DEFAULT_CUT_IN_PORTRAIT_FIT.y), 0, 100),
  };
}

/** Reads fits kept by picture. Anything unreadable comes back as none. */
export function parsePortraitFits(raw: unknown): Record<string, CutInPortraitFit> {
  const parsed = typeof raw === 'string' ? parseJsonObject(raw) : isPlainObject(raw) ? raw : null;
  if (!parsed) return {};
  const fits: Record<string, CutInPortraitFit> = {};
  for (const [identifier, fit] of Object.entries(parsed).slice(0, MAX_FITS)) {
    if (identifier.length > 0) fits[identifier] = normalizePortraitFit(fit);
  }
  return fits;
}

/**
 * How a scene saved before fits moved to the character had a picture fitted, or none. Such fits are
 * only ever read now, never written.
 */
export function legacyScenePortraitFit(
  raw: string | null | undefined,
  imageIdentifier: string
): CutInPortraitFit | null {
  if (!imageIdentifier) return null;
  return parsePortraitFits(raw)[imageIdentifier] ?? null;
}

/** Reads the fits a character keeps, by frame and then by picture. Anything unreadable comes back as none. */
export function parseCharacterPortraitFits(
  raw: string | null | undefined
): Partial<Record<CutInPortraitFrame, Record<string, CutInPortraitFit>>> {
  const parsed = parseJsonObject(raw);
  if (!parsed) return {};
  const byFrame: Partial<Record<CutInPortraitFrame, Record<string, CutInPortraitFit>>> = {};
  for (const frame of CUT_IN_PORTRAIT_FRAMES) {
    const fits = parsePortraitFits(parsed[frame]);
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

/**
 * The fit a launch carries for a picture: the character's own, else the one an older scene kept for
 * the picture, else the default.
 */
export function launchPortraitFit(
  characterFits: string | null | undefined,
  legacySceneFits: string | null | undefined,
  frame: CutInPortraitFrame,
  imageIdentifier: string
): CutInPortraitFit {
  return (
    characterPortraitFitIn(characterFits, frame, imageIdentifier) ??
    legacyScenePortraitFit(legacySceneFits, imageIdentifier) ?? { ...DEFAULT_CUT_IN_PORTRAIT_FIT }
  );
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
 * A fit with the picture dragged across its slot, by a distance in the cut-in's own coordinates.
 *
 * The picture follows the pointer: dragging it right brings more of its left side into view. The
 * further it is blown up, the less of it a drag of the same length covers.
 */
export function panPortraitFit(
  fit: CutInPortraitFit,
  dx: number,
  dy: number,
  slot: { width: number; height: number }
): CutInPortraitFit {
  const across = Math.max(1, slot.width) * fit.zoom;
  const down = Math.max(1, slot.height) * fit.zoom;
  return normalizePortraitFit({ zoom: fit.zoom, x: fit.x - (dx / across) * 100, y: fit.y - (dy / down) * 100 });
}

/** A fit with the picture blown up or shrunk by a factor, held to the range the slot can show. */
export function zoomPortraitFit(fit: CutInPortraitFit, factor: number): CutInPortraitFit {
  return normalizePortraitFit({ ...fit, zoom: Math.round(fit.zoom * factor * 100) / 100 });
}

/** The styles that put a picture into its slot the way the fit says. */
export function portraitFitCss(fit: CutInPortraitFit): { objectPosition: string; transform: string; origin: string } {
  const at = `${fit.x}% ${fit.y}%`;
  return { objectPosition: at, transform: `scale(${fit.zoom})`, origin: at };
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
