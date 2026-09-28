/**
 * The character portrait a cut-in template shows in its portrait slot.
 *
 * A template marks one or more image layers as a portrait slot. At play time the sender picks a
 * character's picture, looks up how that picture was fitted to the template, and sends both along
 * with the launch as a snapshot. Every peer draws the slot from that snapshot rather than from the
 * character as it stands later. The image itself is still resolved from room media storage.
 *
 * How each picture is fitted is kept on the template as JSON keyed by the picture's identifier, so
 * fitting it never touches the picture itself or the character that holds it.
 *
 * The same snapshot carries the character's name for `{character}` in a text layer, so a scene
 * that names the character but has no portrait slot still sends one.
 */

import { usesCharacterName } from '@axe/domain/media/cut-in-text';

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

/**
 * A plain head-and-shoulders shape, drawn in the slot while no picture is given or the picture is
 * missing. It is built in rather than stored, so it needs no file in a saved room and no network.
 */
export const CUT_IN_PORTRAIT_SILHOUETTE_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
      '<g fill="#8b93a3" fill-opacity="0.85">' +
      '<circle cx="100" cy="76" r="40"/>' +
      '<path d="M24 200 C24 150 58 122 100 122 C142 122 176 150 176 200 Z"/>' +
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

/** Reads the fits a template keeps, by picture. Anything unreadable comes back as none. */
export function parsePortraitFits(raw: string | null | undefined): Record<string, CutInPortraitFit> {
  if (!raw || raw.trim().length < 1) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const fits: Record<string, CutInPortraitFit> = {};
    for (const [identifier, fit] of Object.entries(parsed as Record<string, unknown>).slice(0, MAX_FITS)) {
      if (identifier.length > 0) fits[identifier] = normalizePortraitFit(fit);
    }
    return fits;
  } catch {
    return {};
  }
}

/** How the template has a picture fitted, or the default when it was never fitted. */
export function portraitFitFor(raw: string | null | undefined, imageIdentifier: string): CutInPortraitFit {
  if (!imageIdentifier) return { ...DEFAULT_CUT_IN_PORTRAIT_FIT };
  return parsePortraitFits(raw)[imageIdentifier] ?? { ...DEFAULT_CUT_IN_PORTRAIT_FIT };
}

/**
 * The template's fits with one picture's fit written in, as the JSON it stores.
 *
 * The most recent fit is kept last, and the oldest are dropped past 64, so a template used with many
 * characters does not grow without end.
 */
export function withPortraitFit(
  raw: string | null | undefined,
  imageIdentifier: string,
  fit: CutInPortraitFit
): string {
  const fits = parsePortraitFits(raw);
  if (!imageIdentifier) return encodeFits(fits);
  delete fits[imageIdentifier];
  fits[imageIdentifier] = normalizePortraitFit(fit);
  const entries = Object.entries(fits);
  return encodeFits(Object.fromEntries(entries.slice(Math.max(0, entries.length - MAX_FITS))));
}

/** The template's fits without one picture's, as the JSON it stores. */
export function withoutPortraitFit(raw: string | null | undefined, imageIdentifier: string): string {
  const fits = parsePortraitFits(raw);
  delete fits[imageIdentifier];
  return encodeFits(fits);
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
 * The snapshot a launch carries, taken from the template and the chosen picture as they stand now.
 *
 * A template with neither a portrait slot nor the character's name in its text carries none, so a
 * cut-in that never had either plays exactly as before. Without a picture or a name the snapshot
 * still goes, so every peer shows the silhouette and the same stand-in for the name.
 */
export function makePortraitSnapshot(
  template: { layers: readonly PortraitSlotLayer[]; portraitFits: string } | null,
  characterIdentifier: string,
  imageIdentifier: string,
  characterName = ''
): CutInPortraitSnapshot | null {
  if (!template || !(hasPortraitSlot(template.layers) || namesCharacter(template.layers))) return null;
  return {
    characterIdentifier,
    imageIdentifier,
    fit: portraitFitFor(template.portraitFits, imageIdentifier),
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

function encodeFits(fits: Record<string, CutInPortraitFit>): string {
  return Object.keys(fits).length > 0 ? JSON.stringify(fits) : '';
}

function readNumber(value: unknown, fallback: number): number {
  const read = Number(value);
  return typeof value !== 'boolean' && value !== null && value !== '' && Number.isFinite(read) ? read : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
