import { Attributes } from '@axe/core/sync/attributes';
import { SyncObject, SyncVar } from '@axe/core/sync/decorator';
import { GameObject } from '@axe/core/sync/game-object';
import { parseAttributesKeepingIdentifier, toAttributesKeepingIdentifier } from '@axe/core/sync/persisted-identifier';
import { CarriesImages } from '@axe/domain/media/carried-images';

/** One picture in a pack: what it is called, the picture itself and the words it is found by. */
export interface StampItem {
  /** Tells the stamp apart from the others in its pack, and stays the same through edits. */
  readonly id: string;
  readonly name: string;
  readonly imageIdentifier: string;
  readonly words: readonly string[];
}

/** How far a room's stamps may grow, so that sharing them stays light on every seat. */
export const STAMP_LIMITS = {
  packsPerRoom: 20,
  stampsPerPack: 64,
  imageBytes: 256 * 1024,
  imageSide: 512,
  nameLength: 40,
  wordsPerStamp: 16,
  wordLength: 32,
} as const;

const IDENTIFIER_LENGTH = 128;

// Control characters would only break the line a name is shown on.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

/** A pack or stamp name as it is kept: on one line, trimmed and cut to the longest allowed. */
export function normalizeStampName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return Array.from(raw.replace(CONTROL_CHARACTERS, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, STAMP_LIMITS.nameLength)
    .join('')
    .trim();
}

/**
 * The words a stamp is found by, from a list or from text typed into one box.
 *
 * Text is split at spaces and commas, Japanese ones included, and a leading colon is dropped,
 * since that is how the word will be typed in chat. The same word twice, in any case, is kept
 * once; a word too long is cut, and words past the limit are left out.
 */
export function normalizeStampWords(raw: unknown): string[] {
  const pieces = Array.isArray(raw)
    ? raw.filter((one): one is string => typeof one === 'string').flatMap((one) => splitWords(one))
    : typeof raw === 'string'
      ? splitWords(raw)
      : [];
  const seen = new Set<string>();
  const words: string[] = [];
  for (const piece of pieces) {
    const word = Array.from(piece.replace(/^:+/, '')).slice(0, STAMP_LIMITS.wordLength).join('');
    const key = word.toLocaleLowerCase();
    if (word.length === 0 || seen.has(key)) continue;
    seen.add(key);
    words.push(word);
    if (words.length >= STAMP_LIMITS.wordsPerStamp) break;
  }
  return words;
}

function splitWords(text: string): string[] {
  return text.replace(CONTROL_CHARACTERS, ' ').split(/[\s,、，]+/);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= IDENTIFIER_LENGTH;
}

/**
 * A stamp read from anywhere, cleaned up to what a pack keeps, or null when it has no id or no
 * picture to show.
 */
export function toStampItem(raw: unknown): StampItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const held = raw as Record<string, unknown>;
  if (!isIdentifier(held['id']) || !isIdentifier(held['imageIdentifier'])) return null;
  return {
    id: held['id'],
    name: normalizeStampName(held['name']),
    imageIdentifier: held['imageIdentifier'],
    words: normalizeStampWords(held['words']),
  };
}

/**
 * The stamps written in a pack, read leniently: what cannot be read is left out, a stamp whose id
 * came earlier is dropped, and no more than a pack may hold are kept.
 */
export function parseStampItems(text: string): StampItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const items: StampItem[] = [];
  for (const raw of parsed) {
    const item = toStampItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= STAMP_LIMITS.stampsPerPack) break;
  }
  return items;
}

/** Why stamps brought in from a file were turned away. */
export type StampItemsProblem = 'malformed' | 'tooManyStamps';

/**
 * The stamps written in a pack file, read strictly: anything that cannot be read, a stamp given
 * twice or more stamps than a pack may hold turns the whole list away, rather than bringing in
 * part of a pack as though it were all of it.
 */
export function parseStampItemsStrict(text: string): StampItem[] | StampItemsProblem {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 'malformed';
  }
  if (!Array.isArray(parsed)) return 'malformed';
  if (parsed.length > STAMP_LIMITS.stampsPerPack) return 'tooManyStamps';
  const items: StampItem[] = [];
  const seen = new Set<string>();
  for (const raw of parsed) {
    const item = toStampItem(raw);
    if (!item || item.name.length === 0 || seen.has(item.id)) return 'malformed';
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

/** The stamps as the pack writes them. */
export function serializeStampItems(items: readonly StampItem[]): string {
  return JSON.stringify(
    items.map((item) => ({ id: item.id, name: item.name, imageIdentifier: item.imageIdentifier, words: item.words }))
  );
}

/**
 * A set of picture stamps the whole room shares.
 *
 * The stamps ride in one field as written text, so a pack goes to the others, into a saved room
 * and into a pack file as one object. Their pictures are named inside that text, where a walk of
 * the XML does not look, so the pack says which pictures it carries.
 */
@SyncObject('stamp-pack')
export class StampPack extends GameObject implements CarriesImages {
  @SyncVar() name: string = '';
  @SyncVar() stamps: string = '[]';

  private parsedFrom: string | null = null;
  private parsed: StampItem[] = [];

  /** The stamps in the pack, in the order they are shown. */
  get items(): readonly StampItem[] {
    if (this.parsedFrom !== this.stamps) {
      this.parsed = parseStampItems(this.stamps);
      this.parsedFrom = this.stamps;
    }
    return this.parsed;
  }

  /** Replaces the stamps in the pack, keeping only what a pack may hold. */
  setItems(items: readonly StampItem[]): void {
    this.stamps = serializeStampItems(parseStampItems(serializeStampItems(items)));
  }

  /** The stamp with this id, or null. */
  itemOf(id: string): StampItem | null {
    return this.items.find((item) => item.id === id) ?? null;
  }

  get carriedImageIdentifiers(): readonly string[] {
    return [...new Set(this.items.map((item) => item.imageIdentifier))];
  }

  /**
   * The identifier is written out with the rest, since it is how a pack read in again is known
   * for the same pack.
   */
  toAttributes(): Attributes {
    return toAttributesKeepingIdentifier(this);
  }

  /**
   * Reads the pack back, taking up the identifier written with it. Dropped into a room that
   * already has that pack, it comes in beside it as a copy: replacing one is asked about first,
   * and only the stamp panel asks.
   */
  parseAttributes(attributes: NamedNodeMap): void {
    parseAttributesKeepingIdentifier(this, attributes, { whenTaken: 'copy' });
  }
}
